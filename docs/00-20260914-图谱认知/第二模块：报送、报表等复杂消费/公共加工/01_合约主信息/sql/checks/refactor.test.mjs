import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, expand, render } from '../render.mjs';
import { scan, parse } from './sql-shape.mjs';
import { flattenOptionStages } from './option-stages.mjs';
import { inlineKingstarSteps } from './kingstar-stages.mjs';
import { inlineTrsSteps } from './trs-stages.mjs';
import { inlineFastSteps } from './fast-stages.mjs';

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const read = p => readFileSync(join(root, p), 'utf8');
const tokens = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);
const equalSql = (a, b, message) => assert.deepEqual(tokens(a), tokens(b), message);
const translate = text => text.replace(/\brb\.key_book_id\b/gi, 'trade.book_key_book_id').replace(/\brb\./gi, 'trade.').replace(/\bPREMIUM\b(?!\s*\.)/g, 'deal.PREMIUM');
function cteBodies(sql) {
  const t = scan(sql), out = new Map();
  for (let i = 0; i < t.length - 2; i++) {
    if (t[i].depth === 0 && t[i+1].text.toLowerCase() === 'as' && t[i+2].text === '(') {
      const close = t.slice(i+3).find(x => x.text === ')' && x.depth === 0);
      assert.ok(close, 'closed CTE');
      out.set(t[i].text.toLowerCase(), sql.slice(t[i+2].end, close.start));
    }
  }
  return out;
}

for (const b of manifest.branches) {
  test(b.name + ': source SHA, all 90 expressions, all lifted queries and JOINs', () => {
    const original = read(b.reference).replace(/\r?\n$/, '');
    assert.equal(createHash('sha256').update(original).digest('hex'), b.sha256);
    const old = parse(original), sql = render(b.name);
    const comparable = b.grpId === '03' ? inlineKingstarSteps(sql) :
      b.grpId === '02' ? inlineTrsSteps(sql) :
      b.grpId === '04' ? inlineFastSteps(sql) : sql;
    const current = b.grpId === '01' ? flattenOptionStages(sql) : parse(comparable), ctes = cteBodies(comparable);
    assert.equal(current.fields.length, 90);
    old.fields.forEach((f, i) => equalSql(current.fields[i], translate(f), 'output column ' + i));
    equalSql(current.insert, old.insert, 'partition write unchanged');
    assert.doesNotMatch(sql, /^[ \t]*-- @include /m, 'no unexpanded include directives');
    const oldJoins = new Map(old.joins.map(j => [j.alias, j]));
    const actual = new Map(current.joins.map(j => [j.alias, j]));
    for (const [alias, name] of Object.entries(b.ctes)) {
      const prev = oldJoins.get(alias);
      assert.ok(ctes.has(name), 'CTE exists: ' + name);
      equalSql(ctes.get(name), prev.body, 'query body: ' + name);
      equalSql(actual.get(alias).text, prev.text.slice(0, prev.op) + name + prev.text.slice(prev.cl), 'JOIN: ' + name);
    }
    const customer = oldJoins.get('cp');
    equalSql(actual.get('cp').text,
      'left join sale_customer cp' + customer.text.slice(customer.cl).replace(/^\s*cp/i, ''), 'customer JOIN');
    assert.ok(ctes.get('sale_customer').includes("busi_date = '\${data_day_str}'"));
    assert.equal(ctes.get('sale_customer').includes("customer_source = 'MAINLAND'"), b.grpId === '03');
    if (b.grpId !== '03') {
      assert.ok(!actual.has('rb') && !actual.has('tbi'));
      equalSql(actual.get('trade').text, 'from sale_trade trade', 'trade scope');
      equalSql(actual.get('mp').text,
        'left join sale_bundle_plan mp on mp.bundle_id = ' + (b.grpId === '01' ? 'deal' : 'rt') + '.bundle_id', 'bundle JOIN');
      for (const name of ['sale_trade','sale_bundle_plan']) {
        assert.ok(ctes.get(name).includes("busi_date = '\${data_day_str}'"));
      }
    }
    if (oldJoins.has('mid')) equalSql(actual.get('mid').text, oldJoins.get('mid').text, 'FX join remains date-unrestricted');
    equalSql(current.where, old.where.replace(/\bwhere Contr_Status\b/i,
      'where ' + (b.grpId === '01' ? 'deal' : 'rt') + '.Contr_Status'), 'filter');
    const expectedAliases = old.joins.map(j=>j.alias).filter(a=> !['rb','tbi'].includes(a));
    if (b.grpId === '01') {
      // Stage grouping changes textual order only; all predicates/types are checked above,
      // and flattenOptionStages checks that every moved JOIN has its dependencies in scope.
      assert.deepEqual(current.joins.map(j=>j.alias).sort(), [...expectedAliases].sort(), 'all leaf JOINs occur once');
    } else {
      assert.deepEqual(current.joins.map(j=>j.alias), expectedAliases, 'JOIN order and membership preserved');
    }
  });
}

test('shared views retain snapshot joins, UNION ALL, and company used by TRS rules', () => {
  const trade = read('04_业务模块/00_公共视图/01_合格OTC交易及账簿.sql');
  assert.match(trade, /trade\.busi_date = book\.busi_date/);
  assert.match(trade, /book\.company/);
  assert.match(trade, /not in \('10022', '10019'\)/);
  assert.match(trade, /in \('OTC', 'OTC_HK'\)/);
  // Count SQL operators, not explanatory mentions such as UNION ALL in comments.
  const cp = scan(read('04_业务模块/00_公共视图/02_交易对手.sql')).map(t => t.text).join(' ');
  assert.equal((cp.match(/union all/gi) || []).length, 1);
  assert.equal((cp.match(/delete_flag = '0'/g) || []).length, 2);
  assert.match(cp, /department < > 'HK'/); // scanner emits punctuation as separate tokens
  const bundle = read('04_业务模块/00_公共视图/03_组合计划.sql');
  assert.match(bundle, /left join/i);
  assert.match(bundle, /bundle\.busi_date = plan\.busi_date/);
  assert.match(bundle, /bundle\.key_plan_id = plan\.id/);
});

test('include expansion: nested, scheduler parameters untouched', () => {
  const fake = new Map([
    [resolve(root, 'a.sql'), "-- @include nested/b.sql\n"],
    [resolve(root, 'nested/b.sql'), "select '\${data_day_str}', '\${filename}'"],
  ]);
  assert.equal(expand('a.sql', p=>fake.get(p)), "select '\${data_day_str}', '\${filename}'\n");
});

test('include expansion: cycles, escapes and unknown branches fail closed', () => {
  assert.throws(()=>expand('a.sql', ()=> '-- @include a.sql'), /Circular/);
  assert.throws(()=>expand('../escape.sql', ()=> ''), /within/);
  assert.throws(()=>expand('a.txt', ()=> ''), /Only .sql/);
  assert.throws(()=>expand('a.sql', ()=> undefined), /Missing/);
  assert.throws(()=>expand('a.sql', ()=> '  \n'), /Empty SQL include/);
  assert.throws(()=>render('unknown'), /Unknown branch/);
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { root, expand, render } from './render.mjs';
import { scan, parse } from '../../公共加工/合约主信息/sql/checks/sql-shape.mjs';

export const original = readFileSync(join(root, '../../公共加工/经营系数_价差/证据_118141.sql'), 'utf8');
export const read = name => readFileSync(join(root, name), 'utf8');
const clean = sql => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
export function ctes(sql) {
  const tokens = scan(sql), result = new Map();
  for (let i = 0; i < tokens.length - 3; i++) {
    if (tokens[i].depth !== 0 || tokens[i + 1].text.toLowerCase() !== 'as' || tokens[i + 2].text !== '(') continue;
    const close = tokens.findIndex((t, k) => k > i + 2 && t.depth === 0 && t.text === ')');
    assert.ok(close > i);
    result.set(tokens[i].text.toLowerCase(), sql.slice(tokens[i + 2].end, tokens[close].start));
    i = close;
  }
  return result;
}
export function stages() { return ctes(expand()); }
function rewriteWords(sql, mapping) {
  const tokens = scan(sql); let text = sql;
  for (const t of tokens.toReversed()) {
    const value = mapping.get(t.text.toLowerCase());
    if (value !== undefined) text = text.slice(0, t.start) + value + text.slice(t.end);
  }
  return text;
}
function normalize(sql) {
  // Qualify the four originally bare columns to their already verified source.
  const mapping = new Map([
    ['ddct_ptrn','info.Ddct_Ptrn'], ['init_marg_prop','info.Init_Marg_Prop'],
    ['base_marg_rate','info.Base_Marg_Rate'], ['additional_reward','s_ba.Additional_Reward'],
  ]);
  const tokens = scan(sql); let result = sql;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i], value = mapping.get(t.text.toLowerCase());
    if (value && tokens[i - 1]?.text !== '.' && tokens[i - 1]?.text.toLowerCase() !== 'as') {
      result = result.slice(0,t.start)+value+result.slice(t.end);
    }
  }
  result = result.replace(/\b(\w+)\.(\w+)\s+as\s+(\w+)\b/gi,
    (all,a,b,c) => b.toLowerCase() === c.toLowerCase() ? a+'.'+b : all);
  return scan(result).filter(t => t.text !== ';').map(t =>
    /^[A-Za-z_]\w*$/.test(t.text) ? t.text.toLowerCase() : t.text);
}
function replaceSources(sql, definitions) {
  const p = parse(sql); let result = sql;
  for (const j of p.joins.toReversed()) {
    if (!j.table || !definitions.has(j.table.toLowerCase())) continue;
    const q = scan(j.text);
    const key = q.findIndex(t => ['from','join'].includes(t.text.toLowerCase()));
    const start = j.start + q[key + 1].start, end = j.start + q[key + 1].end;
    result = result.slice(0,start)+'(\n'+definitions.get(j.table.toLowerCase())+'\n)'+result.slice(end);
  }
  return result;
}
export function restoreOriginal() {
  const defs = stages();
  const inputs = parse(defs.get('contract_day_inputs'));
  const mapping = new Map(inputs.fields.map(field => {
    const tokens = scan(field), as = tokens.findLast(t => t.depth === 0 && t.text.toLowerCase() === 'as');
    assert.ok(as, 'Every prepared field must have an explicit alias');
    return [tokens.at(-1).text.toLowerCase(), clean(field.slice(0, as.start))];
  }));
  assert.equal(mapping.size, inputs.fields.length, 'No duplicated prepared output names');
  const normal = parse(defs.get('ordinary_income_rows'));
  assert.equal(normal.fields.length, 2);
  assert.deepEqual(normal.joins.map(j=>j.table), ['contract_day_inputs']);
  assert.equal(normal.where, '');
  assert.match(clean(normal.fields[0]), /^inputs\.\*$/i);
  const normalCase = clean(normal.fields[1]).replace(/\s+AS\s+ordinary_daily_income\s*$/i, '');
  assert.match(normalCase, /^CASE\b[\s\S]*\bEND$/i);
  const normalBranches = normalCase.replace(/^CASE\b/i,'').replace(/\bEND$/i,'');
  const raw = parse(defs.get('raw_daily_income'));
  assert.deepEqual(raw.joins.map(j=>j.table), ['ordinary_income_rows']);
  assert.equal(raw.where, '');
  let rawFields = raw.fields.map(f => clean(f).replace(/\bELSE\s+ordinary_daily_income\b/i, normalBranches));
  rawFields = rawFields.map(f => rewriteWords(f, mapping));
  const bodyStart = scan(defs.get('contract_day_inputs')).find(t=>t.depth===0 && t.text.toLowerCase()==='from').start;
  let rawSQL = 'SELECT\n'+rawFields.join(',\n')+'\n'+defs.get('contract_day_inputs').slice(bodyStart);
  rawSQL = replaceSources(rawSQL, defs);
  const adjusted = replaceSources(defs.get('adjusted_daily_income'), new Map([
    ['raw_daily_income',rawSQL], ['paid_reward_by_contract',defs.get('paid_reward_by_contract')]
  ]));
  const allocated = replaceSources(defs.get('allocated_daily_report'), new Map([['adjusted_daily_income',adjusted]]));
  return replaceSources(read('09_日报输出.sql'), new Map([['allocated_daily_report',allocated]]));
}

test('frozen original hash; every original expression, join, filter, window and output order survives reconstruction', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '633235e763cac82cda29bf8fab9ac08d7a798980dc1644392b7304ca541a5e6b');
  assert.deepEqual(normalize(restoreOriginal()), normalize(original));
  assert.equal(parse(read('09_日报输出.sql')).fields.length, 92);
});
test('expanded SQL is current; includes reject empty files, cycles and escaping paths', () => {
  assert.equal(read('完整SQL.sql'), render());
  assert.throws(()=>expand('../x.sql'));
  assert.throws(()=>expand('empty.sql',()=>''), /empty/);
  assert.throws(()=>expand('loop.sql',()=> '-- @include loop.sql'), /Circular/);
  assert.doesNotMatch(expand(), /-- @include/);
});

// Bounded stage expansion for the option prototype; not a general SQL optimizer.
import assert from 'node:assert/strict';
import { scan, parse } from './sql-shape.mjs';

const code = sql => scan(sql).map(t => t.text).join(' ');
export function cteBodies(sql) {
  const tokens = scan(sql), out = new Map();
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].depth === 0 && tokens[i+1].text.toLowerCase() === 'as' && tokens[i+2].text === '(') {
      const close = tokens.slice(i+3).find(t => t.text === ')' && t.depth === 0);
      assert.ok(close, 'closed CTE');
      out.set(tokens[i].text.toLowerCase(), sql.slice(tokens[i+2].end, close.start));
    }
  }
  return out;
}

function resolveExpression(sql, scopes) {
  const t = scan(sql), result = [];
  for (let i = 0; i < t.length; i++) {
    const scope = scopes.get(t[i].text.toLowerCase());
    if (scope && t[i+1]?.text === '.') {
      const name = t[i+2]?.text.toLowerCase();
      assert.ok(scope.has(name), 'unknown stage output: ' + t[i].text + '.' + name);
      result.push(scope.get(name)); i += 2;
    } else result.push(t[i].text);
  }
  return result.join(' ');
}

export function flattenOptionStages(sql) {
  const bodies = cteBodies(sql), stages = new Map(), joins = [], filters = [];
  for (const [name, previousAlias, previousName] of [
    ['option_base', null, null],
    ['option_underlying', 'b', 'option_base'],
    ['option_classified', 'u', 'option_underlying'],
  ]) {
    assert.ok(bodies.has(name), 'required business stage: ' + name);
    const body = bodies.get(name), q = parse(body), scopes = new Map();
    if (previousAlias) {
      assert.equal(q.joins[0].table.toLowerCase(), previousName);
      assert.equal(q.joins[0].alias, previousAlias);
      scopes.set(previousAlias, stages.get(previousName));
    } else {
      assert.equal(q.joins[0].table.toLowerCase(), 'sale_trade');
    }
    // Stage boundaries may project and LEFT JOIN, but must not collapse existing rows.
    assert.ok(!scan(body).some(t => t.depth === 0 &&
      ['distinct','group','having','union','limit','qualify','order'].includes(t.text.toLowerCase())),
      'no row collapsing/reordering operator in business stage');
    const outputs = new Map();
    for (const field of q.fields) {
      const t = scan(field);
      if (t.length === 3 && t[1].text === '.' && t[2].text === '*') {
        assert.equal(t[0].text, previousAlias);
        for (const [k,v] of stages.get(previousName)) outputs.set(k,v);
      } else {
        assert.equal(t.at(-2)?.text.toLowerCase(), 'as', 'explicit stage output alias');
        const key = t.at(-1).text.toLowerCase();
        assert.ok(!outputs.has(key), 'duplicate stage column: ' + key);
        outputs.set(key, resolveExpression(field.slice(0,t.at(-2).start), scopes));
      }
    }
    stages.set(name, outputs);
    const added = q.joins.slice(previousAlias ? 1 : 0);
    if (name === 'option_classified') assert.equal(added.length, 0, 'classification is row-wise');
    for (const j of added) joins.push({...j, text: resolveExpression(j.text, scopes)});
    if (q.where) filters.push(resolveExpression(q.where.replace(/^\s*where\b/i, '').replace(/;\s*$/, ''), scopes));
  }
  const final = parse(sql);
  assert.equal(final.joins[0].table.toLowerCase(), 'option_classified');
  assert.equal(final.joins[0].alias, 'enriched');
  const scopes = new Map([['enriched',stages.get('option_classified')]]);
  for (const j of final.joins.slice(1)) joins.push({...j, text:resolveExpression(j.text,scopes)});
  if (final.where) filters.push(resolveExpression(final.where.replace(/^\s*where\b/i, '').replace(/;\s*$/, ''),scopes));
  assert.equal(filters.length, 1, 'status filter occurs once, in the base stage');
  assert.match(code(bodies.get('option_base')), /where deal \. Contr_Status in/i);
  // Every moved JOIN must reference only itself or aliases already introduced.
  const seen = new Set();
  for (const j of joins) {
    assert.ok(!seen.has(j.alias), 'no repeated leaf JOIN: ' + j.alias);
    seen.add(j.alias);
    const t = scan(j.text), on = t.findIndex(x=>x.text.toLowerCase()==='on');
    for (let i = on + 1; on >= 0 && i < t.length - 2; i++) {
      if (t[i+1].text === '.') assert.ok(seen.has(t[i].text.toLowerCase()), 'JOIN dependency: ' + t[i].text);
    }
  }
  return {...final,
    fields: final.fields.map(f=>resolveExpression(f,scopes)),
    joins, where:'where ' + filters[0] + ';'};
}

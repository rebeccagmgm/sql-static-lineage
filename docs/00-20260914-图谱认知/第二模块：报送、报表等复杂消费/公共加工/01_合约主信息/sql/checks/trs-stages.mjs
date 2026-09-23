// Test-only reversal: compare the four reading steps with the frozen original SQL.
import assert from 'node:assert/strict';
import {scan, parse} from './sql-shape.mjs';
import {cteBodies} from './option-stages.mjs';

const tokens = sql => scan(sql).map(t => t.text.toLowerCase()).join(' ');
export function inlineTrsSteps(sql) {
  const bodies = cteBodies(sql);
  const body = name => {
    assert.ok(bodies.has(name), 'required TRS step: ' + name);
    return bodies.get(name);
  };
  assert.equal(tokens(body('first_initial_positions')),
    'select * from ranked_initial_positions where rk = 1',
    'first step only selects the original rank');

  const details = body('initial_position_details'), q = parse(details);
  assert.equal(tokens(q.joins[0].text), 'from first_initial_positions t');
  assert.equal(q.where, '', 'details cannot filter rows');
  assert.ok(!scan(details).some(t => t.depth === 0 &&
    ['distinct', 'group', 'having', 'union', 'limit', 'qualify', 'order'].includes(t.text.toLowerCase())),
    'details cannot collapse rows');
  const fields = new Map();
  for (const field of q.fields) {
    const t = scan(field);
    assert.equal(t.length, 5, 'detail columns are direct references');
    assert.equal(t[1].text, '.');
    assert.equal(t[3].text.toLowerCase(), 'as');
    const name = t[4].text.toLowerCase();
    assert.ok(!fields.has(name), 'unique detail field');
    fields.set(name, t.slice(0, 3).map(x => x.text).join(' '));
  }
  assert.deepEqual([...fields.keys()], ['key_leg_id', 'underlying_ins_id', 'wind_code',
    'ins_sht_desc', 'init_price', 'init_quantity', 'interotc_underlying_category',
    'ins_family', 'currency', 'ins_lng_desc', 'dw_cd_val_desc', 'future_type']);

  const summary = body('initial_position'), t = scan(summary);
  const from = t.find(x => x.depth === 0 && x.text.toLowerCase() === 'from');
  const group = t.find(x => x.depth === 0 && x.text.toLowerCase() === 'group');
  assert.ok(from && group, 'summary has FROM and GROUP BY');
  assert.equal(tokens(summary.slice(from.start, group.start)),
    'from initial_position_details p', 'summary consumes details without extra joins or filters');
  function resolveFields(text) {
    const ts = scan(text), out = [];
    for (let i = 0; i < ts.length; i++) {
      if (ts[i].text.toLowerCase() === 'p' && ts[i+1]?.text === '.') {
        const source = fields.get(ts[i+2]?.text.toLowerCase());
        assert.ok(source, 'known detail field');
        out.push(source); i += 2;
      } else out.push(ts[i].text);
    }
    return out.join(' ');
  }
  // rk depends only on the preserved left input. Moving rk=1 before LEFT JOIN
  // leaves the matched-row multiplicity unchanged; JOINs and ranking are then
  // compared token-for-token with the frozen original by refactor.test.mjs.
  const flattened = resolveFields(summary.slice(0, from.start)) +
    '\nFROM (' + body('ranked_initial_positions') + ') t\n' +
    q.joins.slice(1).map(j => j.text).join('\n') +
    '\nwhere t.rk = 1\n' + summary.slice(group.start);
  const all = scan(sql);
  const at = all.findIndex((x, i) => x.depth === 0 &&
    x.text.toLowerCase() === 'initial_position' && all[i+1]?.text.toLowerCase() === 'as');
  assert.ok(at >= 0);
  const open = all[at+2], close = all.slice(at+3).find(x => x.depth === 0 && x.text === ')');
  return sql.slice(0, open.end) + flattened + sql.slice(close.start);
}

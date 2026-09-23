// Test-only reversal of FAST reading steps to the frozen original query.
import assert from 'node:assert/strict';
import {scan, parse} from './sql-shape.mjs';
import {cteBodies} from './option-stages.mjs';

const tokens = sql => scan(sql).map(t => t.text.toLowerCase()).join(' ');
export function inlineFastSteps(sql) {
  const bodies = cteBodies(sql);
  const body = name => {
    assert.ok(bodies.has(name), 'required FAST step: ' + name);
    return bodies.get(name);
  };
  assert.equal(tokens(body('first_initial_positions')),
    'select * from ranked_initial_positions where rk = 1',
    'selection keeps exactly the first original rank');
  const details = body('initial_position_details'), q = parse(details);
  assert.equal(tokens(q.joins[0].text), 'from first_initial_positions dy');
  assert.equal(q.where, '', 'details cannot filter rows');
  assert.ok(!scan(details).some(t => t.depth === 0 &&
    ['distinct','group','having','union','limit','qualify','order'].includes(t.text.toLowerCase())),
    'details cannot collapse rows');
  const fields = new Map();
  for (const field of q.fields) {
    const t = scan(field);
    assert.equal(t.at(-2).text.toLowerCase(), 'as', 'explicit detail output alias');
    const name = t.at(-1).text.toLowerCase();
    assert.ok(!fields.has(name), 'unique detail field');
    fields.set(name, t.slice(0, -2).map(x => x.text).join(' '));
  }
  assert.deepEqual([...fields.keys()], ['key_instrument_id','underlying_ins_id','wind_code',
    'ins_sht_desc','ins_lng_desc','underlying_type','ins_family','dw_cd_val_desc',
    'currency','future_type','dynamic_notional']);
  // The original SUM used an unqualified amount column. Check the binding
  // explicitly before restoring that spelling; never erase an arbitrary alias.
  assert.equal(tokens(fields.get('dynamic_notional')), 'dy . dynamic_notional');
  fields.set('dynamic_notional', 'dynamic_notional');
  const summary = body('initial_position'), t = scan(summary);
  const from = t.find(x => x.depth === 0 && x.text.toLowerCase() === 'from');
  const group = t.find(x => x.depth === 0 && x.text.toLowerCase() === 'group');
  assert.ok(from && group);
  assert.equal(tokens(summary.slice(from.start, group.start)), 'from initial_position_details p',
    'summary cannot add joins or filters');
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
  // rk refers solely to the preserved left input. Re-expressing its filter
  // after the LEFT JOINs does not change matched-row multiplicity.
  // refactor.test.mjs then checks every expanded expression/JOIN against
  // the original, including the CASE moved into the detail projection.
  const flattened = resolveFields(summary.slice(0, from.start)) +
    '\nFROM (' + body('ranked_initial_positions') + ') dy\n' +
    q.joins.slice(1).map(j => j.text).join('\n') +
    '\nwhere dy.rk = 1\n' + resolveFields(summary.slice(group.start));
  const all = scan(sql);
  const at = all.findIndex((x, i) => x.depth === 0 &&
    x.text.toLowerCase() === 'initial_position' && all[i+1]?.text.toLowerCase() === 'as');
  assert.ok(at >= 0);
  const open = all[at+2], close = all.slice(at+3).find(x => x.depth === 0 && x.text === ')');
  return sql.slice(0, open.end) + flattened + sql.slice(close.start);
}

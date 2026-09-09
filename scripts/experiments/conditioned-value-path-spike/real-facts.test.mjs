import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { adaptOutput } from './facts-adapter.mjs';
import { proveConditionalValues } from './proof.mjs';

// Run run.mjs once to freeze the real input. Missing input is a failure, not a skip.
const file = new URL('../../../tmp/conditioned-value-path-spike-20260909/frozen-208983.json', import.meta.url);
const frozen = JSON.parse(fs.readFileSync(file, 'utf8'));
const copy = () => structuredClone(frozen);
const relation = (f, id) => f.records['relation-nodes.jsonl'].find(r => r.relation_id === id).relation;
const target = 'cdp000809';
const expected = 'dm_index_n.index_grp_serv_emp_id';
const prove = f => proveConditionalValues(adaptOutput(f, target));
const labels = (f, label) => {
  const c = adaptOutput(f, target);
  const b = c.branches.find(b => b.selector.value === label);
  return relation(f, b.relationId).expressions[0];
};

test('real SQL anchors the service and development cases independently', () => {
  assert.match(frozen.sql, /SELECT 'CDP000809' lab_numr, grp_id, index_val AS lab_val\s+FROM dm_index_n\.index_grp_serv_emp_id/i);
  assert.match(frozen.sql, /SELECT 'CDP000802' lab_numr, grp_id, index_val AS lab_val\s+FROM dm_index_n\.index_grp_devpr_emp_id/i);
  for (const [field, table] of [[target, expected], ['cdp000802', 'dm_index_n.index_grp_devpr_emp_id']]) {
    const c = adaptOutput(frozen, field), r = proveConditionalValues(c);
    assert.equal(c.branches.length, 57);
    assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
    assert.deepEqual(r.paths.map(p => `${p.table}.${p.column}`), [`${table}.index_val`]);
    assert.equal(r.exclusions.length, 56);
    assert.ok(c.prefix.some(p => p.operator === 'COALESCE'));
    assert.ok(c.prefix.some(p => p.operator === 'aggregate'));
    assert.equal(r.controls, 'NOT_EVALUATED');
    assert.equal(r.publicationEligible, false);
  }
});
test('renaming the output does not change the selected label', () => {
  const f = copy();
  const b = f.records['output-field-bindings.jsonl'].find(b => b.target_field === target);
  const e = f.records['field-expression-nodes.jsonl'].find(e => e.expression_id === b.expression_id);
  const raw = relation(f, e.relation_id).expressions.find(x => x.output === e.output_name);
  raw.output = e.output_name = b.target_field = 'independent_output_name';
  assert.equal(proveConditionalValues(adaptOutput(f, 'independent_output_name')).paths[0].table, expected);
});
test('renaming the CTE reader alias preserves binding', () => {
  const f = copy();
  for (const r of f.records['relation-nodes.jsonl']) {
    if (r.relation.binding === 'it') r.relation.binding = 'new_alias';
    for (const e of r.relation.expressions ?? []) {
      for (const a of e.structured_expression?.args ?? []) if (a.qualifier === 'it') a.qualifier = 'new_alias';
    }
  }
  assert.equal(prove(f).paths[0].table, expected);
});
test('reordering every UNION branch preserves origins', () => {
  const f = copy();
  for (const r of f.records['relation-nodes.jsonl']) r.relation.branches?.reverse();
  assert.equal(prove(f).paths[0].table, expected);
});
test('flattening nested UNION groups preserves origins', () => {
  const f = copy(), c = adaptOutput(f, target);
  const rootId = c.branches[0].branchPath[0].relationId;
  relation(f, rootId).branches = c.branches.map(b => b.relationId);
  const r = prove(f);
  assert.equal(r.paths[0].table, expected);
  assert.equal(r.exclusions.length, 56);
});
test('branch-local output aliases are matched by ordinal, not by name', () => {
  const f = copy(), c = adaptOutput(f, target);
  for (const b of c.branches) {
    const n = relation(f, b.relationId);
    n.expressions[0].output = 'renamed_tag'; n.expressions[2].output = 'renamed_value';
    n.output_columns = n.expressions.map(e => e.output);
  }
  assert.equal(prove(f).paths[0].table, expected);
});
test('a second matching real branch produces a second proven path', () => {
  const f = copy(); labels(f, 'CDP000802').structured_expression.text = "'CDP000809'";
  const r = prove(f);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.deepEqual(r.paths.map(p => p.table).sort(), [expected, 'dm_index_n.index_grp_devpr_emp_id'].sort());
});
test('dynamic branch tags retain candidates without claiming completeness', () => {
  const f = copy(); labels(f, 'CDP000802').structured_expression = { kind: 'COLUMN', name: 'dynamic_tag' };
  const r = prove(f);
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.paths.find(p => p.table === 'dm_index_n.index_grp_devpr_emp_id').certainty, 'CANDIDATE');
});
test('missing branches, UNION DISTINCT and binding mismatches fail closed', () => {
  const f = copy(), c = adaptOutput(f, target);
  f.records['relation-nodes.jsonl'] = f.records['relation-nodes.jsonl'].filter(r => r.relation_id !== c.branches[0].relationId);
  assert.throws(() => prove(f), /RELATION_MISSING/);
  const g = copy(); relation(g, c.branches[0].branchPath[0].relationId).all = false;
  assert.throws(() => prove(g), /UNSUPPORTED_OR_INCOMPLETE_SETOP/);
  const h = copy(); h.records['relation-nodes.jsonl'].find(r => r.relation.binding === 'it').relation.binding = 'wrong';
  assert.throws(() => prove(h), /JOIN_BINDING_NOT_UNIQUE/);
});
test('missing read occurrence prevents proving the selected endpoint', () => {
  const f = copy(), c = adaptOutput(f, target);
  const selected = c.branches.find(b => b.selector.value === 'CDP000809');
  for (const io of f.records['dataset-io.jsonl']) io.read_occurrences = (io.read_occurrences ?? [])
    .filter(o => o.occurrence_id !== selected.value.readOccurrenceId);
  assert.equal(prove(f).status, 'PARTIAL');
  assert.equal(prove(f).paths.length, 0);
});
test('unsupported CASE conditions are not silently simplified', () => {
  const f = copy();
  for (const r of f.records['relation-nodes.jsonl']) for (const e of r.relation.expressions ?? r.relation.measures ?? []) {
    const c = e.structured_expression?.args?.[0];
    if (c?.kind === 'CASE') c.whens[0].when.op = '<>';
  }
  assert.throws(() => prove(f), /UNSUPPORTED_CASE/);
});
test('unverified schema references cannot become a proven value endpoint', () => {
  const f = copy(), c = adaptOutput(f, target);
  const selected = c.branches.find(b => b.selector.value === 'CDP000809');
  const value = relation(f, selected.relationId).expressions[2];
  for (const input of value.input_columns) input.resolution = 'SQL_CANDIDATE';
  assert.equal(prove(f).status, 'PARTIAL');
  assert.equal(prove(f).paths.length, 0);
});
test('a matching alias in another lexical scope is rejected', () => {
  const f = copy();
  f.records['relation-nodes.jsonl'].find(r => r.relation.binding === 'it').relation.scope_id = 'another_scope';
  assert.throws(() => prove(f), /JOIN_BINDING_NOT_UNIQUE/);
});
test('cyclic filter references terminate with an explicit gap', () => {
  const f = copy(); const filter = f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.filter'));
  filter.relation.source = filter.relation_id;
  assert.throws(() => prove(f), /REFERENCE_ROUTE_CYCLE/);
});
test('a tiny SQL execution oracle checks exclusion, duplicate tags and default values', () => {
  // Independent execution of the reduced MAX/CASE/COALESCE shape. This is not
  // Hive execution or a production-data acceptance test.
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE x(tag TEXT, value INTEGER)');
    const insert = db.prepare('INSERT INTO x VALUES (?, ?)');
    const query = db.prepare("SELECT coalesce(max(CASE WHEN tag='A' THEN value END), -1) AS value FROM x");
    insert.run('A', 7); insert.run('B', 999);
    assert.equal(query.get().value, 7);
    db.exec("UPDATE x SET value=-999 WHERE tag='B'");
    assert.equal(query.get().value, 7);
    insert.run('A', 11); assert.equal(query.get().value, 11);
    db.exec("DELETE FROM x WHERE tag='A'"); assert.equal(query.get().value, -1);
  } finally { db.close(); }
});

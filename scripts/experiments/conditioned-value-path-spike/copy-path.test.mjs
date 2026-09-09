import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proveCopyPath } from './copy-path.mjs';

const base = new URL('../../../tmp/conditioned-value-path-spike-20260909/multi-case/', import.meta.url);
const load = task => JSON.parse(fs.readFileSync(new URL(`frozen-${task}.json`, base), 'utf8'));
const cases = [
  ['34901', 'ID', 'titans_otcclearing.pos_otc_position_daily', 'id', 'root.read.pos_otc_position_daily'],
  ['34901', 'Busi_date_raw', 'titans_otcclearing.pos_otc_position_daily', 'busi_date', 'root.read.pos_otc_position_daily'],
  ['119044', 'Inr_Ord_Id', 'pdata_n.t03_agt_stati_info_h', 'stati_cont_desc', 'root.c.read.t03_agt_stati_info_h'],
];
for (const [task, field, table, column, suffix] of cases) test(`real ${task}/${field}: independent expected endpoint and old/new occurrence agree`, () => {
  const f = load(task), r = proveCopyPath(f, field);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.equal(r.path.table, table); assert.equal(r.path.column, column);
  assert.ok(r.path.readOccurrenceId.endsWith(`relation:${suffix}`));
  const old = f.baseline.projection.edges.filter(e => e.properties.bindingId === r.bindingId);
  assert.equal(old.length, 1);
  assert.equal(old[0].properties.sourceReadOccurrenceId, r.path.readOccurrenceId);
  assert.equal(r.controlsStatus, 'NOT_EVALUATED');
  assert.equal(r.publicationEligible, false);
});
function rootRef(f) {
  return f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.project'))
    .relation.expressions.find(e => e.output === 'Inr_Ord_Id');
}
test('wrong alias cannot fall back to matching a physical table', () => {
  const f = load('119044'); rootRef(f).structured_expression.qualifier = 'missing';
  assert.equal(proveCopyPath(f, 'Inr_Ord_Id').status, 'NOT_EVALUABLE');
});
test('unqualified same-table references remain ambiguous', () => {
  const f = load('119044'); delete rootRef(f).structured_expression.qualifier;
  assert.match(proveCopyPath(f, 'Inr_Ord_Id').reason, /UNQUALIFIED_JOIN_REFERENCE/);
});
test('selecting K instead of C reaches a different occurrence of the same table', () => {
  const f = load('119044'); rootRef(f).structured_expression.qualifier = 'K';
  const r = proveCopyPath(f, 'Inr_Ord_Id');
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.ok(r.path.readOccurrenceId.endsWith('relation:root.k.read.t03_agt_stati_info_h'));
});
test('duplicate binding and nested-scope substitution cannot masquerade as C', () => {
  const f = load('119044');
  f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.k.project')).relation.scope_id = 'root.c';
  assert.match(proveCopyPath(f, 'Inr_Ord_Id').reason, /JOIN_BINDING_NOT_UNIQUE/);
  const g = load('119044');
  g.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.c.project')).relation.scope_id = 'root.nested.c';
  assert.match(proveCopyPath(g, 'Inr_Ord_Id').reason, /JOIN_BINDING_NOT_UNIQUE/);
});
test('missing occurrence or missing star expansion evidence blocks proof', () => {
  const f = load('119044');
  for (const io of f.records['dataset-io.jsonl']) io.read_occurrences = (io.read_occurrences ?? [])
    .filter(o => !o.relation_id.endsWith('relation:root.c.read.t03_agt_stati_info_h'));
  assert.match(proveCopyPath(f, 'Inr_Ord_Id').reason, /READ_OCCURRENCE_NOT_UNIQUE/);
  const g = load('119044');
  const c = g.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.c.project'));
  const e = c.relation.expressions.find(e => e.output.toLowerCase() === 'stati_cont_desc');
  delete e.star_expansion;
  assert.match(proveCopyPath(g, 'Inr_Ord_Id').reason, /NOT_A_PROVEN_COLUMN_REFERENCE/);
});
test('incomplete schema evidence and cycles cannot become resolved edges', () => {
  const f = load('34901');
  const e = f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.project')).relation.expressions[0];
  e.input_columns[0].resolution = 'SQL_CANDIDATE';
  assert.match(proveCopyPath(f, 'ID').reason, /PHYSICAL_FIELD_NOT_PROVEN/);
  const g = load('34901'); const filter = g.records['relation-nodes.jsonl'].find(r => r.relation_type === 'filter');
  filter.relation.source = filter.relation_id;
  assert.match(proveCopyPath(g, 'ID').reason, /ROUTE_CYCLE/);
});
test('copy verifier does not accept the already-known SYSDATE transformation defect', () => {
  assert.match(proveCopyPath(load('34901'), 'DATA_TIME').reason, /NOT_A_PROVEN_COLUMN_REFERENCE/);
});

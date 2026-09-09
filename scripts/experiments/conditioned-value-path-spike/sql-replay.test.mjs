import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provePath } from './path-witness.mjs';
const base = new URL('../../../tmp/conditioned-value-path-spike-20260909/sql-replay/', import.meta.url);
const load = (task, stage = 'candidate') => JSON.parse(fs.readFileSync(new URL(`${stage}/fresh-${task}.json`, base)));
const strict = { bindingMode: 'explicit' };
test('reparsed real cases preserve the three correct baseline occurrences and eliminate SYSDATE field lineage', () => {
  for (const [task, field] of [['34901', 'ID'], ['34901', 'Busi_date_raw'], ['119044', 'Inr_Ord_Id']]) {
    const f = load(task), before = load(task, 'baseline'), r = provePath(f, field, strict);
    assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
    const edges = before.baseline.projection.edges.filter(e => e.properties.bindingId === r.bindingId);
    assert.equal(edges.length, 1); assert.equal(edges[0].properties.sourceReadOccurrenceId, r.paths[0].readOccurrenceId);
  }
  const r = provePath(load('34901'), 'DATA_TIME', strict);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE'); assert.deepEqual(r.paths, []);
  assert.equal(r.witness.value.args[0].name, 'SYSDATE');
});
test('explicit bindings reject missing, duplicated, wrong-kind and cross-statement/scope mappings', () => {
  for (const mode of ['missing', 'duplicate', 'kind', 'statement', 'scope', 'target-scope']) {
    const f = load('119044'), c = f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.c.project')).relation;
    if (mode === 'missing') delete c.scope_bindings;
    if (mode === 'duplicate') c.scope_bindings.push({ ...c.scope_bindings[0] });
    if (mode === 'kind') c.scope_bindings[0].source_kind = 'cte';
    if (mode === 'statement') c.scope_bindings[0].target_relation_id = 'task:other:statement:0:relation:root.project';
    if (mode === 'scope') c.scope_bindings[0].scope_id = 'root.other';
    if (mode === 'target-scope') c.scope_bindings[0].target_scope_id = 'root.other';
    assert.equal(provePath(f, 'Inr_Ord_Id', strict).status, 'NOT_EVALUABLE', mode);
  }
});
test('opaque scope labels work through saved IDs; no lexical-scope fallback is used', () => {
  const f = load('119044');
  for (const r of f.records['relation-nodes.jsonl']) {
    if (r.relation.scope_id === 'root.c') r.relation.scope_id = 'opaque_scope_17';
    for (const b of r.relation.scope_bindings ?? []) {
      if (b.scope_id === 'root.c') b.scope_id = 'opaque_scope_17';
      if (b.target_scope_id === 'root.c') b.target_scope_id = 'opaque_scope_17';
    }
  }
  for (const io of f.records['dataset-io.jsonl']) for (const o of io.read_occurrences ?? [])
    if (o.scope_id === 'root.c') o.scope_id = 'opaque_scope_17';
  assert.equal(provePath(f, 'Inr_Ord_Id', strict).status, 'PROVEN_WITHIN_SCOPE');
  assert.equal(provePath(f, 'Inr_Ord_Id').status, 'NOT_EVALUABLE');
});
test('missing CTE mapping blocks the final write even with a matching physical summary', () => {
  const f = load('155157');
  delete f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('.pvs.read.t')).relation.scope_bindings;
  assert.equal(provePath(f, 'Actl_Idx_Val', strict).status, 'NOT_EVALUABLE');
});
test('whole replay preserves previous Facts except additive mappings and the known Oracle correction', () => {
  for (const task of ['86840', '155157', '119044', '105387', '208983']) {
    const a = load(task, 'baseline'), b = load(task);
    for (const r of b.records['relation-nodes.jsonl']) delete r.relation.scope_bindings;
    assert.deepEqual(b.records, a.records, task);
  }
  const a = load('34901', 'baseline'), b = load('34901');
  assert.equal(a.records['column-lineage-edges.jsonl'].length - b.records['column-lineage-edges.jsonl'].length, 1);
});

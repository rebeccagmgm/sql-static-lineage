import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proveConditionalValues } from './proof.mjs';

const branch = (id, tag, table) => ({
  relationId: id,
  branchPath: [id],
  selector: { kind: 'LITERAL', value: tag },
  value: { kind: 'FIELD', table, column: 'v', readOccurrenceId: `read:${id}` },
  evidence: [id],
});
const fixture = () => ({
  operation: 'MAX_CASE_EQUALITY',
  output: 'employee',
  selectorValue: 'A',
  branchInventoryComplete: true,
  branches: [branch('a', 'A', 'service'), branch('b', 'B', 'development')],
});

test('excludes a proven nonmatching value branch', () => {
  const r = proveConditionalValues(fixture());
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.deepEqual(r.paths.map(p => p.table), ['service']);
  assert.equal(r.exclusions.length, 1);
});
test('output aliases and branch order do not determine value origins', () => {
  const f = fixture(); f.output = 'unrelated_alias'; f.branches.reverse();
  assert.deepEqual(proveConditionalValues(f).paths.map(p => p.table), ['service']);
});
test('two matching branches remain two paths, even for the same physical field', () => {
  const f = fixture(); f.branches.push(branch('a2', 'A', 'service'));
  const r = proveConditionalValues(f);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.equal(r.paths.length, 2);
  assert.notEqual(r.paths[0].readOccurrenceId, r.paths[1].readOccurrenceId);
});
test('a dynamic tag remains a candidate and makes the result incomplete', () => {
  const f = fixture(); f.branches[1].selector = { kind: 'UNKNOWN' };
  const r = proveConditionalValues(f);
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.paths.find(p => p.table === 'development').certainty, 'CANDIDATE');
  assert.equal(r.exclusions.length, 0);
});
test('an incomplete branch inventory cannot prove completeness', () => {
  const f = fixture(); f.branchInventoryComplete = false;
  assert.equal(proveConditionalValues(f).status, 'PARTIAL');
});
test('a missing read occurrence is a gap, never a proven field path', () => {
  const f = fixture(); delete f.branches[0].value.readOccurrenceId;
  const r = proveConditionalValues(f);
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.paths.length, 0);
});
test('literal comparisons remain case sensitive', () => {
  const f = fixture(); f.branches[0].selector.value = 'a';
  const r = proveConditionalValues(f);
  assert.equal(r.paths.length, 0);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
});
test('unsupported operators and duplicate branch identities fail closed', () => {
  const f = fixture(); f.operation = 'ARBITRARY_CASE';
  assert.equal(proveConditionalValues(f).status, 'NOT_EVALUABLE');
  const g = fixture(); g.branches.push(g.branches[0]);
  assert.equal(proveConditionalValues(g).status, 'NOT_EVALUABLE');
});
test('the proof does not modify its input', () => {
  const f = fixture(); const before = JSON.stringify(f);
  proveConditionalValues(f);
  assert.equal(JSON.stringify(f), before);
});

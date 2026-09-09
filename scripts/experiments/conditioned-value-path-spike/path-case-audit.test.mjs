import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { multiCases, selectCase } from './multi-cases.mjs';
import { provePath } from './path-witness.mjs';
import { auditPathCase } from './path-case-audit.mjs';
const dir = new URL('../../../tmp/conditioned-value-path-spike-20260909/multi-case/', import.meta.url);
function check(id) {
  const c = multiCases.find(c => c.id === id);
  const f = JSON.parse(fs.readFileSync(new URL(`frozen-${c.task}.json`, dir)));
  const x = selectCase(f, c), r = provePath(f, { relationId: x.relation.relation_id, field: c.field });
  return auditPathCase(id, r);
}
test('acceptance gate refuses internally proven but SQL-incorrect SYSDATE lineage', () => {
  const r = check('oracle-clock');
  assert.equal(r.status, 'FAIL'); assert.equal(r.inputsMatchSql, false);
  assert.deepEqual(r.failures, ['SQL_EXPECTED_INPUTS_MISMATCH']);
});
test('acceptance gate distinguishes complete paths, complete assignments and partial windows', () => {
  for (const c of multiCases.filter(c => !['oracle-clock', 'window'].includes(c.id))) {
    const r = check(c.id); assert.equal(r.status, 'PASS_WITHIN_SCOPE', c.id);
  }
  assert.equal(check('window').status, 'PARTIAL');
});

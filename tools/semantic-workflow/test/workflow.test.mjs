import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitize, fingerprint, parseEvents } from '../src/common.mjs';
import { validateResult, requestFor } from '../src/model.mjs';
import { State } from '../src/state.mjs';
import { exportModel } from '../src/runner.mjs';

const pack = { id: 'pack1', hash: 'hash1', title: '合约资料', assets: [{ id: 'asset1', table: 's.contract', fields: [{ name: 'contract_id' }] }], evidence: [{ id: 'ev1', kind: 'metadata', content: {} }], gaps: [] };
const result = () => ({ entities: [{ id: 'contract', name: '合约', definition: '业务合约', properties: [{ name: '编号', type: 'string', evidenceIds: ['ev1'] }], evidenceIds: ['ev1'] }], relations: [], mappings: [{ entityId: 'contract', assetId: 'asset1', scope: '', fields: [{ property: '编号', field: 'contract_id' }], evidenceIds: ['ev1'] }], classifications: [{ entityId: 'contract', product: '公共资料', topic: '合约基本资料', evidenceIds: ['ev1'] }], gaps: [] });

test('redacts credentials and connection information, retains business identifiers', () => {
  const value = sanitize('Bearer sk-example123456789012345 password=abc jdbc:mysql://10.1.2.3:999/a T03_AGT_RELA_H.Agt_Id C:\\Users\\u\\secret');
  assert.ok(!value.includes('example123') && !value.includes('password=abc') && !value.includes('10.1.2.3'));
  assert.ok(value.includes('T03_AGT_RELA_H.Agt_Id'));
  assert.equal(sanitize("password='a b c'; field=contract"), 'password=[REDACTED]; field=contract');
  assert.deepEqual(sanitize({ access_token: 'private', api_key: 'private', field: 'contract' }), { field: 'contract' });
});
test('fingerprints ignore key order but preserve content changes', () => {
  assert.equal(fingerprint({ a: 1, b: 2 }), fingerprint({ b: 2, a: 1 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});
test('stream decoding captures completion and usage, rejects interrupted streams', () => {
  const response = parseEvents('data: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":12}}\n\ndata: [DONE]\n\n');
  assert.equal(response.choices[0].message.content, '{}'); assert.equal(response.usage.total_tokens, 12);
  assert.throws(() => parseEvents('data: {"choices":[{"delta":{"content":"{"}}]}\n\n'), /INCOMPLETE/);
});
test('validates evidence, endpoints, field roles and property mappings', () => {
  assert.deepEqual(validateResult(result(), pack), []);
  let bad = result(); bad.entities[0].evidenceIds = ['invented'];
  assert.ok(validateResult(bad, pack).some(e => e.includes('evidence')));
  bad = result(); bad.relations = [{ name: '关联', from: 'contract', to: 'missing', evidenceIds: ['ev1'] }];
  assert.ok(validateResult(bad, pack).some(e => e.includes('endpoint')));
  bad = result(); bad.mappings[0].fields[0].field = 'invented_column';
  assert.ok(validateResult(bad, pack).some(e => e.includes('field')));
  bad = result(); bad.mappings[0].fields[0].property = '不存在';
  assert.ok(validateResult(bad, pack).some(e => e.includes('property')));
});
test('malformed collections produce validation errors without exceptions', () => {
  assert.ok(validateResult({ entities: [null], relations: {}, mappings: [], classifications: [], gaps: [] }, pack).length);
});
test('request fingerprint changes with model and evidence, never includes key', () => {
  const cfg = { provider: { model: 'm1', maxOutputTokens: 1000, extraBody: {} } };
  const first = requestFor(pack, cfg);
  assert.notEqual(first.hash, requestFor(pack, { provider: { ...cfg.provider, model: 'm2' } }).hash);
  assert.notEqual(first.hash, requestFor({ ...pack, title: '账户' }, cfg).hash);
  assert.ok(first.reserveTokens >= Buffer.byteLength(JSON.stringify(first.body.messages)) + 1000);
});
function stateTest(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'semantic-test-'));
  const state = new State(join(dir, 'state.sqlite'));
  try { fn(state); } finally { state.close(); rmSync(dir, { recursive: true, force: true }); }
}
test('budget reserves before dispatch and survives reopen semantics', () => stateTest(state => {
  state.savePack(pack);
  const id = state.reserve('req1', pack.hash, 80, 100);
  assert.equal(state.usage().accountedTokens, 80);
  assert.throws(() => state.reserve('req2', pack.hash, 30, 100), /BUDGET/);
  state.finish(id, { status: 'success', usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }, result: result() });
  assert.equal(state.usage().accountedTokens, 30);
  assert.equal(state.cached('req1').status, 'success');
}));
test('unknown usage retains reservation and blocks automatic repeat', () => stateTest(state => {
  state.savePack(pack);
  const id = state.reserve('req1', pack.hash, 80, 100);
  state.finish(id, { status: 'uncertain', error: 'timeout' });
  assert.equal(state.usage().accountedTokens, 80);
  assert.equal(state.cached('req1').status, 'uncertain');
}));
test('re-preparing preserves review and versions changed packs separately', () => stateTest(state => {
  state.savePack(pack);
  const id = state.reserve('req1', pack.hash, 80, 100);
  state.finish(id, { status: 'success', usage: { total_tokens: 30 }, result: result() });
  state.review(id, 'accepted', result());
  state.savePack(pack);
  assert.equal(state.items()[0].reviewStatus, 'accepted');
  const retry = state.reserve('new-model', pack.hash, 40, 100);
  state.finish(retry, { status: 'invalid', usage: { total_tokens: 10 }, error: 'new model failure' });
  assert.equal(state.items()[0].reviewStatus, 'accepted');
  state.savePack({ ...pack, hash: 'hash2', title: '新版本' });
  assert.equal(state.items().find(i => i.hash === 'hash1').current, false);
}));

test('export requires human acceptance and reports conflicting canonical definitions', () => stateTest(state => {
  for (const n of [1, 2]) {
    const p = { ...pack, id: `p${n}`, hash: `h${n}` };
    state.savePack(p);
    const id = state.reserve(`req${n}`, p.hash, 20, 100);
    const value = result(); value.entities[0].canonicalId = 'otc/contract';
    if (n === 2) value.entities[0].definition = '定义存在差异';
    state.finish(id, { status: 'success', usage: { total_tokens: 5 }, result: value });
    if (n === 1) assert.equal(exportModel(state).entities.length, 0);
    state.review(id, 'accepted', value);
  }
  const model = exportModel(state);
  assert.equal(model.status, 'conflicts_require_review');
  assert.equal(model.entities.length, 1); assert.equal(model.conflicts.length, 1);
  assert.equal(model.evidencePacks.length, 2); assert.equal(model.executable, false);
  assert.ok(model.mappings.every(m => m.entityId === 'otc/contract'));
}));

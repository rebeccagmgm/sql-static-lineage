import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { State } from '../src/state.mjs';
import { run, chatEndpoint } from '../src/runner.mjs';
import { serve } from '../src/server.mjs';
import { selectSeeds, tableNames } from '../src/sources.mjs';

const pack = { id: 'p1', hash: 'h1', title: '合约', assets: [], evidence: [{ id: 'ev', content: '有数据' }], gaps: [] };
const result = { entities: [], relations: [], mappings: [], classifications: [], gaps: ['无足够依据'] };
test('base URL and complete endpoint resolve to the same request route', () => {
  assert.equal(chatEndpoint('https://example.invalid/v1/').href, 'https://example.invalid/v1/chat/completions');
  assert.equal(chatEndpoint('https://example.invalid/v1/chat/completions').href, 'https://example.invalid/v1/chat/completions');
  assert.throws(() => chatEndpoint('https://user:password@example.invalid/v1'), /INVALID_API/);
});
async function setup(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'semantic-run-')), state = new State(join(dir, 'state.sqlite'));
  const cfg = { outputDirectory: dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'example', maxOutputTokens: 200, timeoutMs: 1000, extraBody: {} }, limits: { totalTokens: 100000 } };
  state.savePack(pack);
  try { await fn({ cfg, state, env: { API: 'https://example.invalid/v1/chat/completions', KEY: 'test-key' } }); }
  finally { state.close(); rmSync(dir, { recursive: true, force: true }); }
}
test('successful results are cached across runs without a second paid request', async () => setup(async ({ cfg, state, env }) => {
  let calls = 0;
  const transport = async (_url, options) => { calls++; assert.equal(options.headers.Authorization, 'Bearer test-key'); return { usage: { total_tokens: 500 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }; };
  await run(cfg, state, [pack], { env, transport });
  await run(cfg, state, [pack], { env, transport });
  assert.equal(calls, 1); assert.equal(state.usage().accountedTokens, 500);
}));
test('timeout is not automatically retried and reservation is kept', async () => setup(async ({ cfg, state, env }) => {
  let calls = 0;
  const transport = async () => { calls++; throw Error('secret echoed upstream'); };
  await run(cfg, state, [pack], { env, transport }); await run(cfg, state, [pack], { env, transport });
  assert.equal(calls, 1); assert.ok(state.usage().uncertainReservedTokens > 0);
  assert.ok(!state.items()[0].error.includes('secret'));
}));
test('missing usage stops the batch even when response JSON is valid', async () => setup(async ({ cfg, state, env }) => {
  const report = await run(cfg, state, [pack, { ...pack, id: 'p2' }], { env, transport: async () => ({ choices: [{ message: { content: JSON.stringify(result) } }] }) });
  assert.equal(report.dispatched, 1); assert.equal(report.stopped, 'usage_missing');
}));
test('budget is checked before invoking provider', async () => setup(async ({ cfg, state, env }) => {
  cfg.limits.totalTokens = 1;
  const report = await run(cfg, state, [pack], { env, transport: async () => { throw Error('must not be called'); } });
  assert.equal(report.dispatched, 0); assert.equal(report.stopped, 'budget');
}));
test('selection rotates groups and fails on unknown requested IDs', () => {
  const seeds = [{ id: 'a1', kind: 'm', group: 'a' }, { id: 'a2', kind: 'm', group: 'a' }, { id: 'b1', kind: 'm', group: 'b' }];
  assert.deepEqual(selectSeeds(seeds, { limit: 2 }).map(s => s.id), ['a1', 'b1']);
  assert.throws(() => selectSeeds(seeds, { ids: ['missing'] }), /SEED_NOT_FOUND/);
});
test('table extraction does not turn escaped newlines into physical names', () => {
  assert.deepEqual(tableNames(['odata.a\nodata.b', { input: 'pdata.c' }]), ['odata.a', 'odata.b', 'pdata.c']);
});
test('local review rejects foreign origin, invalid evidence and missing CSRF', async () => setup(async ({ state }) => {
  const id = state.reserve('req', 'h1', 100, 1000); state.finish(id, { status: 'success', usage: { total_tokens: 10 }, result });
  const server = serve(state, { port: 0 }); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/state`), data = await res.json(); assert.equal(res.status, 200);
    const body = JSON.stringify({ attemptId: id, status: 'draft', result });
    assert.equal((await fetch(`${base}/api/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 403);
    assert.equal((await fetch(`${base}/api/state`, { headers: { Origin: 'https://example.invalid' } })).status, 403);
    const invalidBody = JSON.stringify({ attemptId: id, status: 'accepted', result: { ...result, entities: [{ id: 'e', name: '合约', definition: '候选', properties: [], evidenceIds: ['not-present'] }] } });
    assert.equal((await fetch(`${base}/api/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrf }, body: invalidBody })).status, 400);
    assert.equal(state.items()[0].reviewStatus, 'pending');
    const good = await fetch(`${base}/api/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrf }, body }); assert.equal(good.status, 200);
    assert.equal(state.items()[0].reviewStatus, 'draft');
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

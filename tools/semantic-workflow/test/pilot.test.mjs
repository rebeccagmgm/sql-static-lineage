import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFields, sqlWindows, loadStandards, normalizePilot, PILOT } from '../src/pilot.mjs';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { State } from '../src/state.mjs';
import { validateResult, requestFor } from '../src/model.mjs';
import { saveItemReview, pilotReport, sharedContext, revalidatePilot } from '../src/review.mjs';
import { run } from '../src/runner.mjs';
import { serve } from '../src/server.mjs';

const standards = loadStandards(resolve(import.meta.dirname, '../../..'));
function fixture() {
  const pack = { id: 'models:T03-038', hash: 'p1', sourceId: 'T03-038', title: '期权合约', pilot: PILOT[0], standards, assets: [{ id: 'a1', table: 's.t03_agt', identityStatus: 'unique_metadata_match_not_graph_verified', fields: [{ name: 'agt_id' }, { name: 'party_id' }] }], evidence: [{ id: 'ev1', kind: 'sql_excerpt', content: 'agt_id, party_id' }], gaps: [] };
  const entity = type => ({ id: type, canonicalId: `cdm:7.0.0:${type}`, standardRef: type, alignment: 'pending', name: type, definition: type, properties: [{ name: type === 'Trade' ? 'tradeIdentifier' : 'partyId', type: 'string', evidenceIds: ['ev1'] }], evidenceIds: ['ev1'], decision: 'new', evidenceStatus: 'supported', questions: [] });
  const result = normalizePilot({ entities: [entity('Trade')], relations: [], mappings: [{ entityId: 'Trade', assetId: 'a1', scope: '期权业务日参数范围', fields: [{ property: 'tradeIdentifier', field: 'agt_id' }], coverage: 'partial', note: '交易标识的一部分', evidenceIds: ['ev1'] }], relationMappings: [], unmappedRelations: [], classifications: [], gaps: [] }, pack);
  return { pack, result, entity };
}
async function setup(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'semantic-pilot-')), state = new State(join(dir, 'state.sqlite'));
  const { pack, result } = fixture(); state.savePack(pack);
  const attemptId = state.reserve('req1', pack.hash, 100, 1000); state.finish(attemptId, { status: 'success', usage: { total_tokens: 20 }, result });
  try { await fn({ state, pack, result, attemptId, dir }); } finally { state.close(); rmSync(dir, { recursive: true, force: true }); }
}
const review = ({ result, attemptId }, extra = {}) => ({ attemptId, kind: 'entity', status: 'accepted', item: structuredClone(result.entities[0]), mappings: structuredClone(result.mappings), reason: '', revision: 0, ...extra });

test('pilot covers seven inputs and option precedes ordinary TRS', () => {
  assert.equal(PILOT.length, 7);
  assert.ok(PILOT.findIndex(x => x.sourceId === 'T03-021') < PILOT.findIndex(x => x.sourceId === 'T03-022'));
});
test('key fields beyond the ordinal limit are selected', () => {
  const fields = [...Array.from({ length: 100 }, (_, i) => ({ name: `value_${i}` })), { name: 'KEY_CAPITAL_ACCT_ID' }];
  assert.ok(selectFields(fields, 10).some(f => f.name === 'KEY_CAPITAL_ACCT_ID'));
});
test('SQL evidence includes late relevant blocks and reports omissions', () => {
  const sql = `${'-- filler\n'.repeat(500)}insert into target select key_capital_acct_id from source where rela_type='A18'`;
  const selected = sqlWindows(sql, 1000, ['key_capital_acct_id']);
  assert.equal(selected.truncated, true);
  assert.ok(selected.windows.some(w => w.excerpt.includes("rela_type='A18'")));
});
test('CDM declarations preserve parent, role, reference and contextual cardinality', () => {
  const standards = loadStandards(resolve(import.meta.dirname, '../../..'));
  assert.equal(standards.entries.find(e => e.id === 'Trade').parent, 'TradableProduct');
  const cp = standards.entries.find(e => e.id === 'Counterparty');
  assert.equal(cp.fields.find(f => f.name === 'partyReference').reference, true);
  assert.equal(cp.fields.find(f => f.name === 'role').cardinality, '1..1');
  assert.match(standards.entries.find(e => e.id === 'Party').fields.find(f => f.name === 'account').declaration, /context/);
});
test('custom definitions, invalid CDM attributes and endpoint shortcuts are rejected', () => {
  const { pack, result, entity } = fixture();
  assert.deepEqual(validateResult(result, pack), []);
  const custom = structuredClone(result); custom.entities[0].standardRef = 'OptionContract';
  assert.ok(validateResult(custom, pack).some(e => e.includes('CDM')));
  const property = structuredClone(result); property.entities[0].properties[0].name = 'internalBusinessId';
  assert.ok(validateResult(property, pack).some(e => e.includes('property')));
  const shortcut = structuredClone(result); shortcut.entities.push(entity('Party'));
  shortcut.relations.push({ id: 'TradableProduct.counterparty', standardRef: 'TradableProduct.counterparty', canonicalId: 'cdm:7.0.0:TradableProduct.counterparty', name: 'counterparty', meaning: 'x', from: 'Trade', to: 'Party', role: '交易对手', alignment: 'pending', decision: 'new', evidenceStatus: 'supported', questions: [], evidenceIds: ['ev1'] });
  assert.ok(validateResult(shortcut, pack).some(e => e.includes('endpoints must match')));
});
test('A17/A18 cannot be swapped; unknown links are not formal CDM relationships', () => {
  const { pack, result } = fixture(); pack.pilot = PILOT[2];
  result.unmappedRelations = [{ id: 'link', name: '内部合约账户关联', assetId: 'a1', fromField: 'agt_id', toField: 'party_id', scope: 'Rela_Type=A17', reason: 'CDM 路径待定', evidenceIds: ['ev1'] }];
  assert.ok(validateResult(result, pack).some(e => e.includes('scope')));
  result.unmappedRelations[0].scope = 'Rela_Type=A18'; assert.deepEqual(validateResult(result, pack), []);
  result.unmappedRelations[0].scope = 'Rela_Type IN (A17,A18)'; assert.ok(validateResult(result, pack).some(e => e.includes('scope')));
  result.unmappedRelations[0].scope = 'business_date = processing_date';
  assert.deepEqual(validateResult(result, pack), []); // Source tables need their own real scope, not a target-only code.
  pack.assets[0].table = 's.t03_agt_rela_h'; result.mappings[0].scope = 'Rela_Type=A18';
  assert.ok(validateResult(result, pack).some(e => e.includes('scope')));
  result.unmappedRelations = []; pack.assets[0].table = 's.t03_agt_rela_h'; result.mappings[0].scope = 'Rela_Type=A17';
  assert.ok(validateResult(result, pack).some(e => e.includes('scope')));
  result.mappings[0].scope = 'Rela_Type=A18'; assert.deepEqual(validateResult(result, pack), []);
  assert.equal(result.relations.length, 0);
});
test('item review is independent, persists edits, and feeds later requests with CDM identity', async () => setup(async ctx => {
  const input = review(ctx); input.mappings[0].note = '人工核对：只覆盖标识值，未构造标识来源结构'; input.reason = '核对了编号构造';
  saveItemReview(ctx.state, input);
  const report = pilotReport(ctx.state);
  assert.equal(report.summary.acceptedEdited, 1); assert.equal(report.registry[0].id, 'cdm:7.0.0:Trade');
  assert.equal(report.registry[0].bindings[0].alignment, 'pending');
  const shared = sharedContext(ctx.state, { id: 'models:T03-039', pilot: PILOT[4] });
  assert.equal(shared.confirmed[0].mappings[0].note, input.mappings[0].note);
  const request = requestFor({ ...ctx.pack, id: 'models:T03-039', pilot: PILOT[4] }, { provider: { model: 'mock', maxOutputTokens: 500 } }, shared);
  assert.ok(request.body.messages[1].content.includes(input.mappings[0].note));
  assert.throws(() => saveItemReview(ctx.state, input), /REFRESH/);
  assert.equal(report.summary.reusedAcrossProducts, 0);
}));
test('pending CDM alignment may be reviewed, but missing evidence and fields cannot', async () => setup(async ctx => {
  const input = review(ctx); input.item.questions = ['字段角色待核对'];
  assert.throws(() => saveItemReview(ctx.state, input), /QUESTIONS/);
  input.item.questions = []; input.mappings = [];
  assert.throws(() => saveItemReview(ctx.state, input), /QUESTIONS/);
  input.mappings = structuredClone(ctx.result.mappings); input.mappings[0].fields[0].field = 'invented';
  assert.throws(() => saveItemReview(ctx.state, input), /INVALID_MAPPING/);
  saveItemReview(ctx.state, review(ctx));
  assert.equal(pilotReport(ctx.state).summary.acceptedUnchanged, 1);
}));
test('old generic candidates never enter CDM context; stale input cannot be adopted', async () => setup(async ctx => {
  const legacy = { ...ctx.pack, id: 'legacy', hash: 'legacy', pilot: undefined }; ctx.state.savePack(legacy);
  const id = ctx.state.reserve('old', 'legacy', 20, 1000); ctx.state.finish(id, { status: 'success', usage: { total_tokens: 1 }, result: ctx.result });
  assert.ok(!JSON.stringify(sharedContext(ctx.state, { id: 'next', pilot: PILOT[4] })).includes('legacy'));
  ctx.state.savePack({ ...ctx.pack, hash: 'p2' });
  assert.throws(() => saveItemReview(ctx.state, review(ctx)), /CURRENT/);
}));
test('pilot API requires CSRF; legacy bulk acceptance is disabled for pilot', async () => setup(async ctx => {
  const server = serve(ctx.state, { port: 0 }); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const data = await (await fetch(`${base}/api/pilot`)).json();
    const body = JSON.stringify(review(ctx));
    assert.equal((await fetch(`${base}/api/pilot/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 403);
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrf };
    assert.equal((await fetch(`${base}/api/review`, { method: 'POST', headers, body: JSON.stringify({ attemptId: ctx.attemptId, status: 'accepted', result: ctx.result }) })).status, 400);
    assert.equal((await fetch(`${base}/api/pilot/review`, { method: 'POST', headers, body })).status, 200);
  } finally { await new Promise(r => server.close(r)); }
}));
test('changed human mapping is preserved and never incurs automatic regeneration', async () => setup(async ctx => {
  saveItemReview(ctx.state, review(ctx));
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'm', maxOutputTokens: 500 }, limits: { totalTokens: 100000 } };
  const report = await run(cfg, ctx.state, [ctx.pack], { env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async () => { throw Error('MUST_NOT_CALL'); } });
  assert.equal(report.dispatched, 0); assert.equal(report.skipped, 1);
}));
test('editing endpoint withdraws relation approval with an auditable reason', async () => setup(async ctx => {
  const cp = { ...structuredClone(ctx.result.entities[0]), id: 'Counterparty', canonicalId: 'cdm:7.0.0:Counterparty', standardRef: 'Counterparty', properties: [{ name: 'role', type: 'CounterpartyRoleEnum', evidenceIds: ['ev1'] }] };
  ctx.result.entities.push(cp); ctx.result.mappings.push({ ...structuredClone(ctx.result.mappings[0]), entityId: 'Counterparty', fields: [{ property: 'role', field: 'party_id' }] });
  ctx.result.relations.push({ id: 'TradableProduct.counterparty', canonicalId: 'cdm:7.0.0:TradableProduct.counterparty', standardRef: 'TradableProduct.counterparty', name: 'counterparty', meaning: '原生关系', from: 'Trade', to: 'Counterparty', role: '交易对手角色', alignment: 'pending', decision: 'new', evidenceStatus: 'supported', questions: [], evidenceIds: ['ev1'] });
  ctx.result.relationMappings.push({ relationId: 'TradableProduct.counterparty', assetId: 'a1', fromField: 'agt_id', toField: 'party_id', scope: '仅测试样例', evidenceIds: ['ev1'] });
  ctx.result = normalizePilot(ctx.result, ctx.pack);
  ctx.state.finish(ctx.attemptId, { status: 'success', usage: { total_tokens: 20 }, result: ctx.result });
  saveItemReview(ctx.state, review(ctx, { mappings: [ctx.result.mappings[0]] }));
  saveItemReview(ctx.state, review(ctx, { item: ctx.result.entities[1], mappings: [ctx.result.mappings[1]], revision: 1 }));
  saveItemReview(ctx.state, review(ctx, { kind: 'relation', item: ctx.result.relations[0], mappings: ctx.result.relationMappings, revision: 2 }));
  saveItemReview(ctx.state, review(ctx, { status: 'needs_evidence', reason: '端点角色还需核对', mappings: [ctx.result.mappings[0]], revision: 3 }));
  const latest = ctx.state.db.prepare("SELECT status,reason FROM pilot_review_history WHERE kind='relation' ORDER BY id DESC LIMIT 1").get();
  assert.equal(latest.status, 'draft'); assert.match(latest.reason, /系统撤回/);
  assert.equal(pilotReport(ctx.state).registry.some(d => d.kind === 'relation'), false);
}));
test('identical CDM pilot request reuses cache, with context stored for audit', async () => setup(async ctx => {
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'mock', maxOutputTokens: 500 }, limits: { totalTokens: 1000000 } };
  let calls = 0;
  const options = { env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async () => { calls++; return { usage: { total_tokens: 100 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(ctx.result) } }] }; } };
  await run(cfg, ctx.state, [ctx.pack], options); await run(cfg, ctx.state, [ctx.pack], options);
  assert.equal(calls, 1); assert.equal(ctx.state.db.prepare('SELECT count(*) n FROM attempt_context').get().n, 1);
}));
test('uncertain request blocks replay even after evidence version changes', async () => setup(async ctx => {
  ctx.state.finish(ctx.attemptId, { status: 'uncertain', error: 'TEST_NETWORK_INTERRUPTION' });
  const next = { ...ctx.pack, hash: 'next-evidence' }; ctx.state.savePack(next);
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'mock', maxOutputTokens: 500 }, limits: { totalTokens: 1000000 } };
  const report = await run(cfg, ctx.state, [next], { env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async () => { throw Error('MUST_NOT_CALL'); } });
  assert.equal(report.dispatched, 0); assert.equal(report.stopped, 'uncertain_call_requires_reconciliation');
  assert.equal(pilotReport(ctx.state).items[0].blockingAttempt.id, ctx.attemptId);
}));
test('explicit single-item retry preserves the unknown charge and records replacement', async () => setup(async ctx => {
  ctx.state.finish(ctx.attemptId, { status: 'uncertain', error: 'UNKNOWN_USAGE' });
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'mock', maxOutputTokens: 500 }, limits: { totalTokens: 1000000 } };
  let calls = 0;
  const options = { retryUncertain: true, env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async () => { calls++; return { usage: { total_tokens: 30 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(ctx.result) } }] }; } };
  await run(cfg, ctx.state, [ctx.pack], options);
  assert.equal(ctx.state.attempt(ctx.attemptId).status, 'uncertain');
  assert.equal(ctx.state.usage().uncertainReservedTokens, 100);
  assert.equal(ctx.state.db.prepare('SELECT count(*) n FROM attempt_retries').get().n, 1);
  assert.equal(ctx.state.unresolvedPilot(ctx.pack.id).length, 0);
  await run(cfg, ctx.state, [ctx.pack], { ...options, retryUncertain: false });
  assert.equal(calls, 1);
}));
test('missing entity evidence summary derives only from its valid mapped evidence, with audit', async () => setup(async ctx => {
  const omitted = structuredClone(ctx.result); delete omitted.entities[0].evidenceIds;
  assert.ok(validateResult(omitted, ctx.pack).length);
  ctx.state.finish(ctx.attemptId, { status: 'invalid', usage: { total_tokens: 20 }, result: omitted, error: 'missing summary refs' });
  assert.equal(revalidatePilot(ctx.state)[0].status, 'success');
  assert.deepEqual(ctx.state.items()[0].result.entities[0].evidenceIds, ['ev1']);
  assert.equal(ctx.state.db.prepare('SELECT count(*) n FROM validation_history').get().n, 1);
  assert.equal(ctx.state.usage().reportedTokens, 20);
  const invalid = structuredClone(ctx.result); invalid.entities[0].evidenceIds = ['invented'];
  assert.deepEqual(normalizePilot(invalid, ctx.pack).entities[0].evidenceIds, ['invented']);
  assert.ok(validateResult(normalizePilot(invalid, ctx.pack), ctx.pack).length);
}));
test('paid invalid output receives explicit validation feedback and repaired response is cached', async () => setup(async ctx => {
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'mock', maxOutputTokens: 500 }, limits: { totalTokens: 1000000 } };
  let calls = 0;
  const options = { env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async (_url, options) => {
    calls++; const body = JSON.parse(options.body); const output = structuredClone(ctx.result);
    if (calls === 1) output.entities[0].evidenceIds = ['invented'];
    else { assert.match(body.messages[0].content, /上次输出没有通过程序检查/); assert.ok(JSON.parse(body.messages[1].content).shared.correction.errors.length); }
    return { usage: { total_tokens: 30 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] };
  } };
  assert.equal((await run(cfg, ctx.state, [ctx.pack], options)).stopped, 'invalid_output');
  await run(cfg, ctx.state, [ctx.pack], { ...options, retryFailed: true });
  await run(cfg, ctx.state, [ctx.pack], options);
  assert.equal(calls, 2); assert.equal(ctx.state.db.prepare('SELECT count(*) n FROM request_repairs').get().n, 1);
  assert.equal(ctx.state.items()[0].status, 'success');
}));
test('out-of-selection CDM relation is quarantined intact, never admitted or reviewable', () => {
  const { pack, result } = fixture();
  const r = { id: 'Trade.partyRole', standardRef: 'Trade.partyRole', from: 'Trade', to: 'PartyRole', name: 'roles', meaning: 'candidate', role: '候选角色', canonicalId: 'cdm:7.0.0:Trade.partyRole', decision: 'new', alignment: 'pending', evidenceStatus: 'needs_evidence', questions: ['角色待核验'], evidenceIds: ['ev1'] };
  result.relations.push(r); assert.ok(validateResult(result, pack).length);
  const normalized = normalizePilot(result, pack);
  assert.deepEqual(validateResult(normalized, pack), []);
  assert.equal(normalized.relations.length, 0); assert.equal(normalized.rejectedCandidates[0].item.to, 'PartyRole');
  assert.equal(normalized.validationDisposition, 'partial_with_rejected_candidates');
  for (const change of [{ from: 'invented' }, { to: 'Party' }, { evidenceIds: ['invented'] }]) {
    const bad = structuredClone(result); Object.assign(bad.relations[0], change);
    const normalizedBad = normalizePilot(bad, pack);
    assert.equal(normalizedBad.relations.length, 1);
    assert.ok(validateResult(normalizedBad, pack).length);
  }
  const badMapping = structuredClone(result);
  badMapping.relationMappings.push({ relationId: r.id, assetId: 'invented', fromField: 'x', toField: 'y', scope: 'unknown', evidenceIds: ['invented'] });
  assert.ok(validateResult(normalizePilot(badMapping, pack), pack).length);
  const duplicate = structuredClone(result);
  duplicate.relations.push({ ...r, from: 'Invented', evidenceIds: ['invented'] });
  const normalizedDuplicate = normalizePilot(duplicate, pack);
  assert.equal(normalizedDuplicate.relations.length, 2);
  assert.ok(validateResult(normalizedDuplicate, pack).some(error => error.includes('duplicate')));
});

test('uncertain correction retry preserves feedback and remains repairable and cacheable', async () => setup(async ctx => {
  const cfg = { outputDirectory: ctx.dir, provider: { endpointEnv: 'API', apiKeyEnv: 'KEY', model: 'mock', maxOutputTokens: 500 }, limits: { totalTokens: 1000000 } };
  let calls = 0; const bodies = [];
  const options = { env: { API: 'https://example.invalid/v1', KEY: 'test' }, transport: async (_url, request) => {
    calls++; bodies.push(JSON.parse(request.body));
    if (calls === 2) throw Error('NETWORK_INTERRUPTION');
    const output = structuredClone(ctx.result);
    if (calls < 4) output.entities[0].evidenceIds = ['invented'];
    return { usage: { total_tokens: 30 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] };
  } };
  assert.equal((await run(cfg, ctx.state, [ctx.pack], options)).stopped, 'invalid_output');
  assert.equal((await run(cfg, ctx.state, [ctx.pack], { ...options, retryFailed: true })).stopped, 'uncertain_call');
  assert.equal((await run(cfg, ctx.state, [ctx.pack], { ...options, retryUncertain: true })).stopped, 'invalid_output');
  assert.deepEqual(bodies[1], bodies[2]);
  assert.equal((await run(cfg, ctx.state, [ctx.pack], { ...options, retryFailed: true })).dispatched, 1);
  assert.equal((await run(cfg, ctx.state, [ctx.pack], options)).dispatched, 0);
  assert.equal(calls, 4); assert.equal(ctx.state.unresolvedPilot(ctx.pack.id).length, 0);
  assert.equal(ctx.state.items()[0].status, 'success');
}));

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { provePath } from './path-witness.mjs';
import { multiCases, selectCase } from './multi-cases.mjs';

const dir = new URL('../../../tmp/conditioned-value-path-spike-20260909/multi-case/', import.meta.url);
const load = t => JSON.parse(fs.readFileSync(new URL(`frozen-${t}.json`, dir)));
function selected(id, frozen = null) {
  const c = multiCases.find(c => c.id === id), f = frozen ?? load(c.task);
  const x = selectCase(f, c);
  return { f, raw: x.raw, n: x.relation.relation, target: { relationId: x.relation.relation_id, field: c.field } };
}
const prove = id => { const x = selected(id); return provePath(x.f, x.target); };
const values = r => r.paths.filter(p => p.role === 'VALUE');
const shortRead = p => p.readOccurrenceId.split('relation:')[1];
const price = 'pdata_n.t98_sb_otc_opt_sub_trd_prcg_indx';
const priceRead = 'root.(child).poepm.read.t98_sb_otc_opt_sub_trd_prcg_indx';

test('real SUM/NVL follows its CTE through POEPM to pv, separating three grouping inputs', () => {
  const r = prove('aggregate');
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.deepEqual(values(r).map(p => [p.table, p.column, shortRead(p)]), [[price, 'pv', priceRead]]);
  assert.deepEqual(r.paths.filter(p => p.role === 'GROUP_KEY').map(p => p.column),
    ['prcg_date', 'undrl_pric_shift_prop', 'vola_shift_prop']);
  assert.equal(r.witness.value.name, 'SUM');
  assert.equal(r.witness.value.args[0].name, 'NVL');
  assert.equal(r.witness.value.args[0].args[1].text, '0');
});

test('real subtraction preserves left/right and PVS/BP routes even when physical endpoint is identical', () => {
  const r = prove('arithmetic'), ps = values(r);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE'); assert.equal(ps.length, 2);
  assert.deepEqual(ps.map(p => [p.table, p.column, shortRead(p)]), [[price, 'pv', priceRead], [price, 'pv', priceRead]]);
  for (const [i, alias] of ['PVS', 'BP'].entries()) {
    assert.ok(ps[i].route.some(s => s.operator === 'JOIN_INPUT' && s.alias === alias));
    assert.ok(ps[i].route.some(s => s.relationId?.endsWith(`.${alias.toLowerCase()}.read.t`)));
    assert.equal(ps[i].route.filter(s => s.operator === 'SUM').length, 1);
  }
  assert.ok(ps[0].route.some(s => s.position === 'left'));
  assert.ok(ps[1].route.some(s => s.position === 'right'));
  assert.equal(r.witness.value.right.args[1].text, '0');
});

test('write-bound UNION output retains three branches and four value routes by ordinal', () => {
  const r = provePath(load('155157'), 'Actl_Idx_Val');
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE'); assert.ok(r.bindingId);
  assert.deepEqual(values(r).map(p => [p.table, p.column]),
    [[price, 'pv'], [price, 'pv'], [price, 'delta'], ['pdata_n.t98_otc_deri_undrl_trd_lmt_idx', 'actl_idx_val']]);
  assert.deepEqual(values(r).map(p => p.route.filter(s => s.operator === 'UNION_BRANCH').map(s => s.ordinal)),
    [[0, 0], [0, 0], [0, 1], [1]]);
});

test('changing UNION branch output names and order preserves independently expected value multiset', () => {
  const x = selected('union');
  const rs = x.f.records['relation-nodes.jsonl'];
  for (const r of rs.filter(r => r.relation.type === 'setop')) r.relation.branches.reverse();
  const branchIds = new Set(rs.flatMap(r => r.relation.branches ?? []));
  for (const r of rs.filter(r => r.relation.type === 'project' && branchIds.has(r.relation_id))) {
    const e = r.relation.expressions[4];
    if (e.aggregate === true) {
      const aggregate = rs.find(s => s.relation_id === r.relation.source).relation;
      aggregate.measures.find(m => m.output === e.output).output = 'renamed_branch_value';
    }
    r.relation.expressions[4].output = 'renamed_branch_value';
    r.relation.output_columns[4] = 'renamed_branch_value';
  }
  const r = provePath(x.f, x.target);
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.deepEqual(values(r).map(p => p.column).sort(), ['actl_idx_val', 'delta', 'pv', 'pv']);
});

test('missing or cyclic CTE links fail instead of recovering from the flattened physical summary', () => {
  for (const mode of ['missing', 'cycle']) {
    const x = selected('aggregate');
    const read = x.f.records['relation-nodes.jsonl'].find(r => r.relation_id === x.n.source).relation;
    read.source = mode === 'missing' ? 'missing' : x.target.relationId;
    const r = provePath(x.f, x.target);
    assert.equal(r.status, 'NOT_EVALUABLE'); assert.equal(r.paths.length, 0);
    assert.match(r.reason, /RELATION_MISSING|ROUTE_CYCLE/);
  }
});

test('duplicate named CTE output is rejected', () => {
  const x = selected('aggregate');
  const cte = x.f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('relation:root.(child).project')).relation;
  cte.expressions.push(structuredClone(cte.expressions.find(e => e.output === 'PV')));
  assert.match(provePath(x.f, x.target).reason, /NAMED_OUTPUT_NOT_UNIQUE/);
});

test('missing group evidence and mismatched aggregate mirror do not pass', () => {
  const x = selected('aggregate'); x.n.group_by.pop();
  assert.match(provePath(x.f, x.target).reason, /GROUP_EVIDENCE_INCOMPLETE/);
  const y = selected('arithmetic');
  const p = y.f.records['relation-nodes.jsonl'].find(r => r.relation_id.endsWith('.pvs.project')).relation;
  p.expressions.find(e => e.output === 'PV').structured_expression.name = 'MAX';
  assert.match(provePath(y.f, y.target).reason, /AGGREGATE_OUTPUT_NOT_IDENTICAL/);
});

test('UNION width mismatch, duplicate branch, missing branch and DISTINCT are rejected', () => {
  for (const mode of ['width', 'duplicate', 'missing', 'distinct']) {
    const x = selected('union');
    if (mode === 'width') x.n.output_columns.pop();
    if (mode === 'duplicate') x.n.branches[1] = x.n.branches[0];
    if (mode === 'missing') x.n.branches[1] = 'absent';
    if (mode === 'distinct') x.n.all = false;
    assert.equal(provePath(x.f, x.target).status, 'NOT_EVALUABLE', mode);
  }
});

test('real CASE preserves result literals, ordered selectors and ELSE without turning selectors into values', () => {
  const r = prove('conditional-literals');
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE'); assert.equal(values(r).length, 0);
  assert.deepEqual(r.paths.map(p => [p.role, p.table]), [
    ['BRANCH_SELECTOR', 'odata_n_tit.d_ref_trs'], ['BRANCH_SELECTOR', 'odata_n_tit.d_ref_otc_option_deal'],
    ['BRANCH_SELECTOR', 'odata_n_tit.d_ref_fx_forward'], ['BRANCH_SELECTOR', 'odata_n_tit.d_ref_fast_trs']]);
  assert.deepEqual(r.witness.value.whens.map(w => w.then.text), ["'20206'", "'20207'", "'20208'", "'20206'"]);
  assert.equal(r.witness.value.elseExpr.text, "''");
});

test('real ROW_NUMBER reaches partition and ordering occurrences while retaining incomplete window metadata', () => {
  const r = prove('window'); assert.equal(r.status, 'PARTIAL'); assert.equal(values(r).length, 0);
  assert.deepEqual(r.paths.map(p => [p.role, p.column, shortRead(p)]), [
    ['WINDOW_PARTITION', 'key_instrument_id', 'root.fee.t.read.d_trd_daily_accrual_fee'],
    ['WINDOW_ORDER', 'calc_date', 'root.fee.t.read.d_trd_daily_accrual_fee']]);
  assert.deepEqual(r.gaps, ['WINDOW_FRAME_NOT_EXPOSED']);
  assert.equal(r.witness.window.inputs[1].direction, 'ASC');
  assert.equal(r.witness.window.inputs[1].nulls, 'UNSPECIFIED');
});

test('window missing spec, unproven field and missing occurrence cannot pass', () => {
  for (const mode of ['spec', 'field', 'occurrence']) {
    const x = selected('window');
    if (mode === 'spec') delete x.raw.window_spec;
    if (mode === 'field') x.raw.window_spec.input_bindings[0].input_columns[0].resolution = 'SQL_CANDIDATE';
    if (mode === 'occurrence') for (const io of x.f.records['dataset-io.jsonl']) io.read_occurrences = [];
    assert.equal(provePath(x.f, x.target).status, 'NOT_EVALUABLE', mode);
  }
});

test('assignments retain literal/parameter/clock expressions with zero invented physical paths', () => {
  for (const id of ['constant', 'empty-string', 'date-parameter', 'parameter-transform', 'hive-clock']) {
    const r = prove(id); assert.equal(r.status, 'PROVEN_WITHIN_SCOPE', id); assert.equal(r.paths.length, 0, id);
  }
  assert.equal(prove('date-parameter').witness.value.text, "'${data_day_str}'");
  assert.equal(prove('hive-clock').witness.value.args[0].name, 'unix_timestamp');
});

test('independent SYSDATE expectation catches an internally consistent but wrong upstream field', () => {
  const r = prove('oracle-clock');
  // Deliberately do not teach the walker a business-case bypass. This proves
  // connectivity alone cannot certify semantic correctness of Machine Facts.
  assert.equal(r.status, 'PROVEN_WITHIN_SCOPE');
  assert.equal(values(r)[0].column, 'sysdate');
  const sqlExpectedPhysicalInputs = [];
  assert.notDeepEqual(values(r).map(p => p.column), sqlExpectedPhysicalInputs);
  assert.equal(r.publicationEligible, false);
});

test('unrecognized expression modifiers cannot be silently erased', () => {
  const x = selected('aggregate'); x.raw.structured_expression.distinct = true;
  assert.match(provePath(x.f, x.target).reason, /UNSUPPORTED_FUNCTION_MODIFIER/);
});

test('reduced SQL oracle: aggregate, both subtraction operands, null defaults and UNION ALL', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE t(g TEXT, shifted INTEGER, pv INTEGER, delta INTEGER); CREATE TABLE direct(v INTEGER)');
    const ins = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?)');
    ins.run('A', 0, 10, 2); ins.run('A', 1, 25, 3); ins.run('A', 1, null, 4);
    ins.run('B', 1, 7, 1); db.exec('INSERT INTO direct VALUES (99), (99)');
    const sql = `WITH pvs AS (SELECT g, shifted, SUM(COALESCE(pv,0)) AS pv FROM t GROUP BY g, shifted),
      bp AS (SELECT g, SUM(COALESCE(pv,0)) AS pv FROM t WHERE shifted=0 GROUP BY g)
      SELECT 'difference' AS branch, pvs.g, pvs.shifted, pvs.pv-COALESCE(bp.pv,0) AS v
      FROM pvs LEFT JOIN bp ON pvs.g=bp.g
      UNION ALL SELECT 'delta', g, shifted, SUM(COALESCE(delta,0)) FROM t GROUP BY g,shifted
      UNION ALL SELECT 'direct', '', 0, v FROM direct`;
    const run = () => db.prepare(sql).all();
    const diff = rows => rows.filter(r => r.branch === 'difference').map(r => r.v);
    assert.deepEqual(diff(run()), [0, 15, 7]);
    assert.equal(run().filter(r => r.branch === 'direct').length, 2);
    db.exec("UPDATE t SET pv=14 WHERE g='A' AND shifted=0");
    assert.deepEqual(diff(run()), [0, 11, 7]); // BP changes independently of shifted PVS.
    db.exec("UPDATE t SET pv=28 WHERE g='A' AND shifted=1 AND pv IS NOT NULL");
    assert.deepEqual(diff(run()), [0, 14, 7]);
    assert.deepEqual(run().filter(r => r.branch === 'delta').map(r => r.v), [2, 7, 1]);
  } finally { db.close(); }
});

test('reduced SQL oracle: window ordering, partitions and CASE first-match behavior', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE fee(instrument TEXT, calc_date INTEGER); INSERT INTO fee VALUES ('A',2),('A',1),('B',1)");
    const q = "SELECT instrument,calc_date,row_number() OVER (PARTITION BY instrument ORDER BY calc_date) AS rn FROM fee ORDER BY instrument,calc_date";
    assert.deepEqual(db.prepare(q).all().map(r => r.rn), [1, 2, 1]);
    db.exec("INSERT INTO fee VALUES ('A',0)");
    assert.deepEqual(db.prepare(q).all().map(r => r.rn), [1, 2, 3, 1]);
    const c = db.prepare("SELECT CASE WHEN ? IS NOT NULL THEN '20206' WHEN ? IS NOT NULL THEN '20207' ELSE '' END AS v");
    assert.equal(c.get(1, 1).v, '20206'); assert.equal(c.get(null, 1).v, '20207');
    assert.equal(c.get(null, null).v, '');
  } finally { db.close(); }
});

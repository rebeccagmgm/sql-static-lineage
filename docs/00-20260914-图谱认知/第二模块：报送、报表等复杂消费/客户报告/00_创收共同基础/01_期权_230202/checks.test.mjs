import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render } from '../render.mjs';
import { scan, parse } from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const tokens = sql => scan(sql).map(token => token.text);
const branch = '01_期权_230202';
const core = () => parse(parse(render(branch)).joins[0].body);
const expression = name => core().fields.find(field => new RegExp(`\\bas\\s+${name}\\b`, 'i').test(field));
const flatten = sql => sql.replace(/\b(info|det|fee|pe|pd|u|cr|mid|co|co_c)\.(\w+)/g, '$1_$2');
const fields = ['Curr_Rev', 'Opt_Npv_Curr_Rev', 'prop_ratio', 'End_Pric_Date', 'Is_Preterm_Flag'];
const expressions = () => fields.map(name => expression(name));
const columnNames = () => [...new Set(expressions().flatMap(sql => [...sql.matchAll(/\b(info|det|fee|pe|pd|u|cr|mid|co|co_c)\.(\w+)/g)].map(m => `${m[1]}_${m[2]}`)))];
const stringColumn = name => /(?:Src_Contr_Type|Undrl_Curr|Cros_Crrc_Type_Cd|Marg_Agt_Id|Cntr|Cutp_Pty_Id|prop_group|Undrl_Sum_Compr|busi_date|Strt_Pric_Date|Early_Term_Date|End_Pric_Date)$/.test(name);
const baseRow = overrides => ({
  info_Src_Contr_Type: 'VANILLA', info_Undrl_Curr: 'CNY', info_Cros_Crrc_Type_Cd: 'NONE',
  info_Marg_Agt_Id: '', info_Init_Marg_Prop: 0.2, info_Base_Marg_Rate: 0.1, info_Opt_Fee_Rate: 0.1,
  info_Cntr: 'DYNAMIC_HEDGING', info_Cutp_Pty_Id: 'CUSTOMER', info_prop_group: null,
  info_Strt_Pric_Date: '2026-01-05', info_Early_Term_Date: null, info_End_Pric_Date: '2026-12-31',
  info_Bgng_Npv: 1000, info_Init_Nom_Prin: 100,
  det_busi_date: '2026-01-05', det_Init_Nom_Prin: 100, det_Dyna_Nom_Prin: 1000000,
  pe_Undrl_Sum_Compr: 'U1', pe_busi_date: '2026-01-05', pe_delta: 30, pe_Simu_Hedg_Pal: 100,
  pd_Tdy_Yield: 20, u_Tdy_Yield: 400, mid_mid_price: 1,
  fee_OTHER_Prvs_Fee: 10, fee_PREMIUM_Prvs_Fee: 100, cr_ir: 5, co_CAPITAL_COST: 0.02, co_c_CAPITAL_COST: 0.03,
  ...overrides,
});
const dynamicRows = () => [baseRow({}), baseRow({ pe_delta: 70, pe_Simu_Hedg_Pal: 200, pd_Tdy_Yield: -10, info_Bgng_Npv: 2000 })];

// Execute actual delivered SELECT expressions, preserving their windows and CASE order.
// Alias flattening replaces the already-joined row context only; it does not test source joins.
function evaluate(rows) {
  const db = new DatabaseSync(':memory:');
  try {
    db.function('if', (condition, yes, no) => condition ? yes : no);
    const columns = columnNames();
    db.exec(`CREATE TABLE joined_rows (id INTEGER, ${columns.map(c => `${c} ${stringColumn(c) ? 'TEXT' : 'REAL'}`).join(',')})`);
    const insert = db.prepare(`INSERT INTO joined_rows VALUES (${Array(columns.length + 1).fill('?').join(',')})`);
    rows.forEach((row, index) => insert.run(index, ...columns.map(c => row[c] ?? null)));
    return db.prepare(`SELECT id, ${expressions().map(flatten).join(',')} FROM joined_rows ORDER BY id`).all().map(r => ({ ...r }));
  } finally { db.close(); }
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('current source SHA, all expanded query tokens, 74 columns and DDL stay fixed', () => {
  assert.equal(createHash('sha256').update(source.raw).digest('hex'), '3463c9011c052dd6b9a6cae48a32e8ac39817a7fcdff05b0e294bdde033f9af5');
  assert.deepEqual(tokens(render(branch)), tokens(source.query));
  assert.deepEqual(tokens(read('10_目标表结构.sql')), tokens(source.ddl));
  assert.equal(parse(render(branch)).fields.length, 74);
  assert.equal(core().fields.length, 74);
  assert.deepEqual(parse(render(branch)).fields.slice(-4).map(f => f.trim()), ['Agt_Clas_Cd', 'Src_Undrl_Type', 'busi_date', 'grp_id']);
  assert.equal(read('完整SQL.sql'), render(branch));
});

test('two-contract dynamic example allocates the shared residual and keeps NPV separate', () => {
  const rows = evaluate(dynamicRows());
  assert.deepEqual(rows.map(r => r.Curr_Rev), [150, 260]);
  assert.deepEqual(rows.map(r => r.prop_ratio), [0.3, 0.7]);
  assert.deepEqual(rows.map(r => r.Opt_Npv_Curr_Rev), [1000, 2000]);
  near(rows.reduce((sum, row) => sum + row.Curr_Rev, 0), 410);
});

test('absolute delta, distinct window groups, missing FX and zero denominator remain visible', () => {
  const rows = dynamicRows(); rows[0].pe_delta = -30;
  assert.deepEqual(evaluate(rows).map(r => r.Curr_Rev), [150, 260]);
  rows[1].pe_Undrl_Sum_Compr = 'U2';
  assert.deepEqual(evaluate(rows).map(r => r.Curr_Rev), [420, 390]);
  assert.deepEqual(evaluate(dynamicRows().map(r => ({ ...r, mid_mid_price: null }))).map(r => r.Curr_Rev), [150, 260]);
  assert.deepEqual(evaluate(dynamicRows().map(r => ({ ...r, pe_delta: 0 }))).map(r => r.Curr_Rev), [null, null]);
});

const staticRows = () => [
  baseRow({ info_Cntr: 'STATIC_HEDGING', info_prop_group: 'A', pd_Tdy_Yield: 40, pe_delta: null }),
  baseRow({ info_Cntr: 'STATIC_HEDGING', info_prop_group: 'A', pd_Tdy_Yield: 60, pe_delta: null, info_Init_Nom_Prin: 300, det_Init_Nom_Prin: 300, info_Bgng_Npv: 3000 }),
];
test('static example uses det numerator, info denominator and group converted sums', () => {
  assert.deepEqual(evaluate(staticRows()).map(r => [r.Curr_Rev, r.Opt_Npv_Curr_Rev]), [[25, 1000], [75, 3000]]);
  const rows = staticRows(); rows[0].det_Init_Nom_Prin = 200;
  assert.deepEqual(evaluate(rows).map(r => r.Curr_Rev), [50, 75]);
  rows[0].info_Cutp_Pty_Id = 'DEV1100101715'; rows[0].det_Init_Nom_Prin = 100;
  near(evaluate(rows)[0].Curr_Rev, 100 / 3);
  near(evaluate(rows)[1].Curr_Rev, 100);
});

test('NPV only triggers on each row start day; early termination does not filter joined rows', () => {
  const rows = dynamicRows(); rows[0].info_Strt_Pric_Date = '2026-01-04'; rows[0].info_Early_Term_Date = '2026-01-03';
  const output = evaluate(rows)[0];
  assert.equal(output.Opt_Npv_Curr_Rev, 0);
  assert.equal(output.Curr_Rev, 150);
  assert.equal(output.End_Pric_Date, '2026-01-03');
  assert.equal(output.Is_Preterm_Flag, '1');
  rows[0].info_Early_Term_Date = '';
  assert.equal(evaluate(rows)[0].End_Pric_Date, '');
  assert.equal(evaluate(rows)[0].Is_Preterm_Flag, '0');
});

test('airbag priority does not remove rows from dynamic windows or suppress independent NPV', () => {
  const rows = dynamicRows(); rows[0].info_Src_Contr_Type = 'AIRBAGX';
  const result = evaluate(rows);
  near(result[0].Curr_Rev, 80); assert.equal(result[0].Opt_Npv_Curr_Rev, 1000);
  assert.equal(result[1].Curr_Rev, 260);
  rows[0].info_Cros_Crrc_Type_Cd = 'FLEXO';
  near(evaluate(rows)[0].Curr_Rev, 80); // CNY still takes the first branch.
});

test('three actual airbag expressions and associated-margin switch', () => {
  const gas = baseRow({ info_Src_Contr_Type: 'RISKY', info_Cntr: 'OTHER' });
  near(evaluate([gas])[0].Curr_Rev, 80);
  near(evaluate([{ ...gas, info_Marg_Agt_Id: 'RELATED' }])[0].Curr_Rev, 76.25);
  near(evaluate([{ ...gas, info_Undrl_Curr: 'HKD', info_Cros_Crrc_Type_Cd: 'COMPOSITE' }])[0].Curr_Rev, 80);
  const flexo = { ...gas, info_Undrl_Curr: 'USD', info_Cros_Crrc_Type_Cd: 'FLEXO', fee_PREMIUM_Prvs_Fee: 200 };
  near(evaluate([flexo])[0].Curr_Rev, 34.65753424657535);
  near(evaluate([{ ...flexo, info_Marg_Agt_Id: 'RELATED' }])[0].Curr_Rev, 26.43835616438355);
  near(evaluate([{ ...flexo, info_Cros_Crrc_Type_Cd: 'OTHER' }])[0].Curr_Rev, 130.54794520547946);
  near(evaluate([{ ...flexo, fee_PREMIUM_Prvs_Fee: 100 }])[0].Curr_Rev, -65.34246575342465);
});

test('airbag negative premium bypasses cost but NULL fee/configuration and zero fee rate do not become zero', () => {
  const gas = baseRow({ info_Src_Contr_Type: 'AIRBAGX' });
  near(evaluate([{ ...gas, fee_PREMIUM_Prvs_Fee: -1, co_c_CAPITAL_COST: null }])[0].Curr_Rev, 10);
  assert.equal(evaluate([{ ...gas, fee_OTHER_Prvs_Fee: null }])[0].Curr_Rev, null);
  assert.equal(evaluate([{ ...gas, fee_PREMIUM_Prvs_Fee: null }])[0].Curr_Rev, null);
  assert.equal(evaluate([{ ...gas, co_c_CAPITAL_COST: null }])[0].Curr_Rev, null);
  assert.equal(evaluate([{ ...gas, info_Opt_Fee_Rate: 0 }])[0].Curr_Rev, null);
  near(evaluate([{ ...gas, co_c_CAPITAL_COST: 0 }])[0].Curr_Rev, 110);
});

test('cost interval inner SQL switches at effective date and last interval ends at report day', () => {
  const cnyBody = parse(parse(render(branch)).joins[0].body).joins.find(j => j.alias === 'co_c').body;
  const interval = parse(cnyBody).joins[0].body.replaceAll('${yyyy-MM-dd}', '2026-09-22');
  const db = new DatabaseSync(':memory:');
  try {
    const add = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(n)); return d.toISOString().slice(0, 10); };
    db.function('date_add', add); db.function('date_sub', (date, n) => add(date, -n));
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_ois; CREATE TABLE odata_n_ois.g_client_revenue_coefficient (value REAL, effective_date TEXT, busi_date TEXT, is_del TEXT, contract_type TEXT, coefficient_type TEXT, currency TEXT)");
    const put = db.prepare('INSERT INTO odata_n_ois.g_client_revenue_coefficient VALUES (?,?,?,?,?,?,?)');
    put.run(0.03, '2026-01-01', '2026-09-22', 'N', 'AIRBAGX', 'CAPITAL_COST', 'CNY');
    put.run(0.04, '2026-07-01', '2026-09-22', 'N', 'AIRBAGX', 'CAPITAL_COST', 'CNY');
    const intervals = db.prepare(interval).all().map(r => ({ ...r }));
    assert.deepEqual(intervals, [{ value: 0.03, strt_date: '2026-01-01', end_Date: '2026-06-30' }, { value: 0.04, strt_date: '2026-07-01', end_Date: '2026-09-22' }]);
    near(evaluate([baseRow({ info_Src_Contr_Type: 'AIRBAGX', co_c_CAPITAL_COST: intervals[1].value })])[0].Curr_Rev, 70);
  } finally { db.close(); }
});

test('window, CASE order and denominator mutations are detected by whole-query token comparison', () => {
  const actual = render(branch);
  for (const [before, after] of [["info.Src_Contr_Type in ('RISKY','AIRBAGX')", "info.Src_Contr_Type in ('AIRBAGX')"], ['partition by pe.Undrl_Sum_Compr, pe.busi_date', 'partition by pe.Undrl_Sum_Compr'], ['coalesce(det.Init_Nom_Prin, 0)', 'coalesce(info.Init_Nom_Prin, 0)']]) {
    assert.ok(actual.includes(before));
    assert.notDeepEqual(tokens(actual.replace(before, after)), tokens(source.query));
  }
});

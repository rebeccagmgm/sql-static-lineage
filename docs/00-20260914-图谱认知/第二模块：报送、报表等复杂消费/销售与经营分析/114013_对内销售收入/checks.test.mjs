import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {root, render, expand} from './render.mjs';
import {scan, parse} from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(resolve(root, name), 'utf8');
const low = token => token.text.toLowerCase();
const tokens = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? low(t) : t.text);
const source = read('证据_114013.sql');
const metadata = JSON.parse(read('来源字段证据.json'));

function stages(sql) {
  const ts = scan(sql), bodies = {}; let i = 0;
  assert.equal(low(ts[i++]), 'with');
  while (true) {
    const name = low(ts[i++]);
    assert.equal(low(ts[i++]), 'as');
    const open = ts[i++]; assert.equal(open.text, '(');
    const close = ts.findIndex((t, j) => j >= i && t.text === ')' && t.depth === open.depth);
    assert.ok(close > i); assert.ok(!(name in bodies));
    bodies[name] = sql.slice(open.end, ts[close].start); i = close + 1;
    if (ts[i].text !== ',') break;
    i++;
  }
  return {bodies, final: sql.slice(ts[i].start), prefix: sql.slice(0, ts[i].start)};
}
function restore(sql) {
  const {bodies, final} = stages(sql), used = new Set();
  function inline(body, active = []) {
    const ts = scan(body), edits = [];
    for (let i = 0; i < ts.length - 1; i++) {
      if (!['from', 'join'].includes(low(ts[i]))) continue;
      const name = low(ts[i + 1]);
      if (!(name in bodies)) continue;
      assert.ok(!active.includes(name), 'Recursive CTE'); used.add(name);
      edits.push({start: ts[i + 1].start, end: ts[i + 1].end,
        value: '(' + inline(bodies[name], [...active, name]) + ')'});
    }
    for (const e of edits.reverse()) body = body.slice(0, e.start) + e.value + body.slice(e.end);
    return body;
  }
  const original = inline(final);
  assert.deepEqual([...used].sort(), Object.keys(bodies).sort());
  return original;
}

test('assembled CTEs restore every original token, JOIN, window and 52-column output order', () => {
  assert.deepEqual(tokens(restore(render())), tokens(source));
  assert.equal(parse(stages(render()).final).fields.length, 52);
  assert.deepEqual(parse(stages(render()).final).fields.map(tokens), parse(source).fields.map(tokens));
});
test('generated SQL and frozen evidence index stay current', () => {
  assert.equal(read('完整SQL.sql'), render());
  const evidence = JSON.parse(read('证据索引.json'));
  assert.equal(createHash('sha256').update(source).digest('hex'), evidence.querySqlSha256);
});
test('wiring, coefficient precedence and formula mutations fail token restoration', () => {
  for (const [before, after] of [
    ['from contract_day_income t', 'from contract_info t'],
    ['cb.Base_Coef,b.Base_Coef,0', 'b.Base_Coef,cb.Base_Coef,0'],
    ['* 0.4', '* 0.5'],
  ]) {
    assert.ok(render().includes(before));
    assert.throws(() => assert.deepEqual(tokens(restore(render().replaceAll(before, after))), tokens(source)));
  }
});
test('include graph rejects path escape, non-SQL, cycles and empty input', () => {
  for (const name of ['../outside.sql', 'README.md']) assert.throws(() => expand(name, () => 'SELECT 1'));
  assert.throws(() => expand('00_主脚本.sql', () => '-- @include 00_主脚本.sql'), /Circular/);
  assert.throws(() => expand('00_主脚本.sql', () => ''), /empty/);
});

// Run the actual complete delivered query over constructed local rows.
// The three Hive lateral-view patterns below receive narrow SQLite equivalents.
// This adapter covers normal ISO dates, nonnegative bounded spans and split strings;
// it does not assert Hive behavior for invalid dates, negative spans or numeric text.
function adapted(sql) {
  return sql
    .replaceAll('${yyyy-MM-dd}', '2026-09-21')
    .replace(/select agt_id, x\.rel_agt_id, Bgng_Npv/gi, 'select agt_id, x.value as rel_agt_id, Bgng_Npv')
    .replace(/lateral view explode\(split\(rel_agt_id,','\)\) x as rel_agt_id/gi,
      'JOIN json_each(split_json(rel_agt_id)) x')
    .replace(/\bt\.Undrl_Type\b/, 't.value as Undrl_Type')
    .replace(/lateral view explode\(split\(Undrl_Type,','\)\) t as Undrl_Type/gi,
      'JOIN json_each(split_json(Undrl_Type)) t')
    .replace(/date_add\(strt_date, pos\)/gi, 'date_add(strt_date, y.value)')
    .replace(/lateral view posexplode\(split\(space\(datediff\(end_date, strt_date\)\), ' '\)\) y as pos, val/gi,
      'JOIN json_each(day_offsets(datediff(end_date, strt_date))) y')
    .replace(/AS\s+String\b/gi, 'AS TEXT');
}
function shifted(date, days) {
  if (date === null || days === null) return null;
  return new Date(Date.parse(date) + Number(days) * 86400000).toISOString().slice(0, 10);
}
function withDb(action) {
  const db = new DatabaseSync(':memory:');
  db.function('if', (condition, yes, no) => condition ? yes : no);
  db.function('date_add', shifted);
  db.function('date_sub', (date, days) => days === null ? null : shifted(date, -Number(days)));
  db.function('datediff', (a, b) => a === null || b === null ? null : (Date.parse(a) - Date.parse(b)) / 86400000);
  db.function('split_json', value => JSON.stringify(value === null ? [] : String(value).split(',')));
  db.function('day_offsets', span => {
    if (!Number.isInteger(span) || span < 0 || span > 2000) throw Error('Unsupported fixture date span');
    return JSON.stringify(Array.from({length: span + 1}, (_, i) => i));
  });
  db.function('unix_timestamp', () => 1790000000);
  db.function('from_unixtime', (timestamp, format) => '2026-09-21 12:00:00');
  try { return action(db); } finally { db.close(); }
}
const names = {
  info: 'pdata_n.t98_otc_deri_comp_sale_info', dy: 'pdata_n.t98_otc_deri_comp_sale_adtnl_det',
  cp: 'pdata_n.t01_otc_deri_cust', mp: 'pdata_n.t99_otc_deri_inr_base_mapping',
  sp: 'pdata_n.t99_deri_comp_sprd_coef_ref', b: 'pdata_n.t99_otc_deri_inr_base_ref',
  cb: 'pdata_n.t99_deri_comp_base_coef_ref', m: 'pdata_n.t98_otc_comp_mng_rela_info',
};
function fixture(change = {}) {
  return withDb(db => {
    db.exec("ATTACH DATABASE ':memory:' AS pdata_n");
    const info = {
      agt_id: 'INR_DEMO', busi_type: 'OPTION', cutp_pty_id: 'CUST_DEMO',
      cutp_pty_full_name: '构造客户', src_contr_type: 'NORMAL', src_sub_contr_type: '',
      src_undrl_type: 'EQUITY', src_undrl_type_desc: '股票', res_flag: '0',
      strt_pric_date: '2026-09-18', end_pric_date: '2026-09-20', early_term_date: null,
      hedg_type_cd: 'SELF', indt_cd: '99', book_bel_dept: 'OTC', undrl_curr: 'CNY',
      grp_id: '01', busi_date: '2026-09-21', init_marg_prop: 0.2, fee_rate: 0.07,
      bgng_npv: 1200, rel_agt_id: 'REL_A,REL_B', term_days: 3, ...change.info,
    };
    const days = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'];
    const rows = {
      info: [info, ...(change.related ?? [])],
      dy: change.days ?? days.map((day, i) => ({agt_id: 'INR_DEMO', busi_date: day,
        init_nom_prin: 3650000, dyna_nom_prin: [3650000, 2920000, 1825000, 0][i], marg_prop: 0.3, ...change.dy})),
      cp: [{pty_id: 'CUST_DEMO', src_tbl: 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY',
        busi_date: '2026-09-21', del_flag: '0', montr_flag: '1', ...change.cp}],
      mp: [{op_mng_comp_type_id: 'CD017', op_mng_comp_type_desc: '其他',
        src_agt_type_cd: info.src_contr_type, src_agt_sub_type_cd: null, src_undrl_type_cd_str: 'ALL_STOCK',
        src_tbl: 'ODATA_N_OIS.G_INR_CONTRACT_MAPPING', busi_date: '2026-09-21', src_deleted_flag: '0', ...change.mp}],
      sp: [{agt_id: 'IDENTITY_OK', inr_comp_no: 'INR_DEMO', sprd_calc_type: 'ANNUALIZED',
        annu_sprd_coef: 0.002, absl_sprd_coef: 0.01, vld_date: '2026-09-18',
        src_tbl: 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE', coef_type: 'INR', del_flag: '0', ...change.sp}],
      b: [{op_mng_comp_type_id: 'CD017', dft_base_coef: 1, base_yield: 0.004, adtnl_yield: 0.002,
        calc_way: 'ANNUALIZED', actl_vld_day: '2026-09-01', src_tbl: 'ODATA_N_OIS.G_INR_BASE_RATE',
        busi_date: '2026-09-21', src_deleted_flag: '0', ...change.b}],
      cb: [{agt_id: 'IDENTITY_OK', inr_comp_no: 'INR_DEMO', dft_base_coef: 2, base_yield: 0.003,
        calc_type: 'ABSOLUTE', src_tbl: 'ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE', del_flag: '0', ...change.cb}],
      m: [{agt_id: 'INR_DEMO', busi_date: '2026-09-21', inr_main_oper_user_id: 'MAIN',
        inr_intro_oper_user_id: 'INTRO', ...change.m}],
    };
    for (const alias of change.missing ?? []) rows[alias] = [];
    for (const [alias, extras] of Object.entries(change.extra ?? {})) rows[alias].push(...extras.map(row => ({...rows[alias][0], ...row})));
    for (const [alias, table] of Object.entries(names)) {
      const columns = metadata.tables.find(t => t.qualified_name === table).fields.map(f => f.name);
      db.exec('CREATE TABLE ' + table + ' (' + columns.map(c => '"' + c + '"').join(',') + ')');
      const insert = db.prepare('INSERT INTO ' + table + ' VALUES (' + columns.map(() => '?').join(',') + ')');
      for (const row of rows[alias]) insert.run(...columns.map(c => row[c] ?? null));
    }
    const {prefix, final} = stages(render());
    const query = tail => db.prepare(adapted(prefix + tail)).all().map(row => ({...row}));
    return {
      classified: query("SELECT * FROM contract_info WHERE Agt_Id='INR_DEMO'"),
      npv: query('SELECT * FROM b2b_initial_value'),
      raw: query('SELECT * FROM contract_day_income ORDER BY Accrued_Date'),
      allocated: query('SELECT * FROM allocated_day_income ORDER BY Accrued_Date'),
      report: query(final + ' ORDER BY Accrued_Date'),
    };
  });
}
const near = (actual, expected) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-8,
  `expected ${expected}, got ${actual}`);
const incomes = result => result.allocated.map(row => row.Sales_Income);

test('INR_DEMO follows actual classification, date/parameter JOINs, income, 40/60 and report output', () => {
  const result = fixture();
  assert.equal(result.classified[0].Undrl_Type_n, 'CIR_STOCK');
  assert.equal(result.classified[0].Inr_Contr_Type_Cd, null);
  assert.equal(result.raw[0].Contr_Type_Cd, 'CD017');
  assert.deepEqual(incomes(result), [100, 80, 50, 0]);
  assert.deepEqual(result.allocated.map(r => r.Sales_Income_Main), [40, 32, 20, 0]);
  assert.deepEqual(result.allocated.map(r => r.Accum_Sales_Income), [100, 180, 230, 230]);
  near(result.allocated[3].Accum_Sales_Income_Main, 92);
  near(result.allocated[3].Accum_Sales_Income_Intro, 138);
  near(result.allocated[3].Accum_Dyna_Nom_Prin, 8395000);
  assert.equal(typeof result.report[0].Sales_Income, 'string');
  near(result.report[0].Sales_Income, 100);
  assert.equal(result.report[0].busi_date, '2026-09-21');
  assert.equal(result.report[0].Accrued_Date, '2026-09-18');
});
test('fieldwise precedence: type calculation, contract coefficient/rate and spread source are independent', () => {
  assert.deepEqual(incomes(fixture({cb: {dft_base_coef: null}})), [50, 40, 25, 0]);
  assert.deepEqual(incomes(fixture({missing: ['cb']})), [60, 48, 30, 0]);
  const absolute = fixture({b: {calc_way: null}});
  incomes(absolute).forEach((value, index) => near(value, index === 0 ? 94900 : 0));
  assert.equal(absolute.raw[0].Sprd_Rate, 0.002, 'display uses sp ANNUALIZED while formula uses ABSOLUTE');
  const blank = fixture({b: {calc_way: ''}});
  assert.equal(blank.raw[0].Sales_Income, null);
  assert.equal(blank.allocated[0].Sales_Income, 0);
});
test('missing rates and missing people preserve display NULL while formulas and allocation use their own fallback', () => {
  const result = fixture({missing: ['b', 'cb', 'sp', 'm']});
  assert.equal(result.raw[0].Base_Coef, null);
  assert.equal(result.raw[0].Base_Rate, null);
  assert.equal(result.raw[0].Sprd_Rate, null);
  assert.deepEqual(incomes(result), [0, 0, 0, 0]);
  const mainOnly = fixture({m: {inr_intro_oper_user_id: ''}});
  assert.deepEqual(mainOnly.allocated.map(r => r.Sales_Income_Main), [100, 80, 50, 0]);
  assert.deepEqual(mainOnly.allocated.map(r => r.Sales_Income_Intro), [0, 0, 0, 0]);
});
test('B2B reads and sums actual linked NPV, chooses first branch, then allocates once', () => {
  const result = fixture({info: {hedg_type_cd: 'B2B', src_contr_type: 'AIRBAGX'}, related: [
    {agt_id: 'REL_A', bgng_npv: -200, busi_date: '2026-09-21'},
    {agt_id: 'REL_B', bgng_npv: -100, busi_date: '2026-09-21'},
  ]});
  assert.equal(result.npv[0].initial_npv, 900);
  assert.deepEqual(incomes(result), [900, 0, 0, 0]);
  assert.equal(result.allocated[3].Accum_Sales_Income_Main, 360);
  assert.equal(result.allocated[3].Accum_Sales_Income_Intro, 540);
  const missing = fixture({info: {hedg_type_cd: 'B2B'}});
  assert.equal(missing.npv[0].initial_npv, null);
  assert.equal(missing.raw[0].Sales_Income, null);
  assert.equal(missing.allocated[0].Sales_Income, 0);
  const partial = fixture({info: {hedg_type_cd: 'B2B'}, related: [
    {agt_id: 'REL_A', bgng_npv: -200, busi_date: '2026-09-21'},
  ]});
  assert.equal(partial.raw[0].Sales_Income, 1000);
  const repeated = fixture({info: {hedg_type_cd: 'B2B', rel_agt_id: 'REL_A,REL_A'}, related: [
    {agt_id: 'REL_A', bgng_npv: -200, busi_date: '2026-09-21'},
  ]});
  assert.equal(repeated.raw[0].Sales_Income, 800);
});
test('old B2B and absolute contracts are recognized on the literal 2023-01-01 boundary', () => {
  const days = ['2023-01-01', '2023-01-02'].map(busi_date => ({agt_id: 'INR_DEMO', busi_date,
    init_nom_prin: 3650000, dyna_nom_prin: 3650000}));
  const absolute = fixture({info: {strt_pric_date: '2022-12-01'}, days,
    b: {actl_vld_day: '2022-12-01', calc_way: 'ABSOLUTE'}, sp: {vld_date: '2022-12-01'}});
  incomes(absolute).forEach((value, index) => near(value, index === 0 ? 94900 : 0));
  const b2b = fixture({info: {strt_pric_date: '2022-12-01', hedg_type_cd: 'B2B'}, days,
    related: [{agt_id: 'REL_A', bgng_npv: -200, busi_date: '2026-09-21'}]});
  assert.deepEqual(incomes(b2b), [1000, 0]);
});
test('RISKY/AIRBAG uses initial margin, retains the 100%-margin exception and negative income', () => {
  for (const src_contr_type of ['RISKY', 'AIRBAGX', 'AIRBAGM', 'AIRBAGL']) {
    const result = fixture({info: {src_contr_type}});
    near(result.raw[0].Fin_Rati, 0.7);
    near(result.raw[0].Sales_Income, 80);
    near(result.allocated[3].Accum_Sales_Income, 184);
  }
  for (const init_marg_prop of [1, null])
    assert.deepEqual(incomes(fixture({info: {src_contr_type: 'AIRBAGX', init_marg_prop}})), [100, 80, 50, 0]);
  const negative = fixture({info: {src_contr_type: 'AIRBAGX', init_marg_prop: 1.2}});
  near(negative.raw[0].Sales_Income, -20);
  near(negative.allocated[3].Accum_Sales_Income, -46);
});
test('B_LONG_SHORT_SWAP uses daily margin only, unlike displayed Fin_Rati; missing daily margin gives full multiplier', () => {
  const normal = fixture({info: {src_contr_type: 'B_LONG_SHORT_SWAP', busi_type: 'TRS'}});
  near(normal.raw[0].Sales_Income, 70);
  assert.equal(normal.classified[0].Undrl_Type_n, '');
  assert.equal(normal.raw[0].Undrl_Type, 'CIR_STOCK');
  const missing = fixture({info: {src_contr_type: 'B_LONG_SHORT_SWAP'}, dy: {marg_prop: null}});
  near(missing.raw[0].Fin_Rati, 0.8);
  near(missing.raw[0].Sales_Income, 100);
  const capped = fixture({info: {src_contr_type: 'B_LONG_SHORT_SWAP'}, dy: {marg_prop: 1.2}});
  near(capped.raw[0].Sales_Income, 0);
});
test('actual source filters and joins remove missing detail/customer but preserve known literal exceptions', () => {
  assert.equal(fixture({missing: ['dy']}).raw.length, 0);
  assert.equal(fixture({cp: {montr_flag: '0'}}).raw.length, 0);
  assert.equal(fixture({info: {grp_id: '04'}}).raw.length, 0);
  assert.equal(fixture({info: {early_term_date: ''}}).raw.length, 0);
  const exception = fixture({info: {cutp_pty_id: 'DEV1100100652'},
    cp: {pty_id: 'DEV1100100652', del_flag: '1', montr_flag: '0'}});
  assert.equal(exception.raw.length, 4);
});
test('income lacks end-date guard; accumulated principal has it; duplicate joins affect windows', () => {
  const late = fixture({days: [{agt_id: 'INR_DEMO', busi_date: '2026-09-21',
    init_nom_prin: 3650000, dyna_nom_prin: 3650000}]});
  assert.equal(late.allocated[0].Sales_Income, 100);
  assert.equal(late.allocated[0].Accum_Dyna_Nom_Prin, 0);
  const duplicate = fixture({extra: {cp: [{}]}});
  assert.equal(duplicate.raw.length, 8);
  assert.equal(duplicate.allocated[0].Accum_Sales_Income, 200);
  assert.equal(duplicate.allocated[7].Accum_Sales_Income, 460);
});
test('spread switches by accrued day while type base remains pinned to the contract start day', () => {
  const result = fixture({extra: {sp: [{vld_date: '2026-09-20', annu_sprd_coef: 0.006}],
    b: [{actl_vld_day: '2026-09-20', dft_base_coef: 100, base_yield: 0.5}]}});
  incomes(result).forEach((value, index) => near(value, [100, 80, 90, 0][index]));
});
test('classification CASE order and mapping subtype NULL versus empty are retained', () => {
  const cross = fixture({info: {src_contr_type: 'RISKY', ex_rate_model: 'SHENZHEN_HONGKONG_STOCK_CONNECT', hedg_type_cd: 'B2B'}});
  assert.equal(cross.classified[0].Inr_Contr_Type_Cd, 'CD025');
  const explicit = fixture({info: {src_undrl_type: 'INDEX', indt_cd: '11'}});
  assert.equal(explicit.raw[0].Contr_Type_Cd, 'CD002');
  const explicitDuplicate = fixture({info: {src_undrl_type: 'INDEX', indt_cd: '11'},
    mp: {src_undrl_type_cd_str: 'NON_STOCK'}, extra: {mp: [{}]}});
  assert.equal(explicitDuplicate.raw.length, 8, 'explicit classification does not prevent mapping expansion');
  assert.ok(explicitDuplicate.raw.every(row => row.Contr_Type_Cd === 'CD002'));
  const wildcard = fixture({info: {src_sub_contr_type: 'SUB'}, mp: {op_mng_comp_type_id: 'DEMO_MAP'}});
  assert.equal(wildcard.raw[0].Contr_Type_Cd, 'DEMO_MAP');
  const empty = fixture({info: {src_sub_contr_type: 'SUB'}, mp: {op_mng_comp_type_id: 'DEMO_MAP', src_agt_sub_type_cd: ''}});
  assert.equal(empty.raw[0].Contr_Type_Cd, 'CD017');
});
test('README local links and include files exist', () => {
  for (const [, target] of read('README.md').matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:|^#/.test(target)) continue;
    assert.ok(existsSync(resolve(root, target.split('#')[0])), target);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { root, render, expand } from './render.mjs';
import { scan, parse } from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(resolve(root, name), 'utf8');
const source = read('../../公共加工/99_证据/220979-query.sql');
const tokens = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);

function stages(sql) {
  const ts = scan(sql), bodies = {};
  let i = 0;
  assert.equal(ts[i++].text.toLowerCase(), 'with');
  while (true) {
    const name = ts[i++].text.toLowerCase();
    assert.equal(ts[i++].text.toLowerCase(), 'as');
    const open = ts[i++];
    assert.equal(open.text, '(');
    const close = ts.findIndex((t, j) => j >= i && t.text === ')' && t.depth === open.depth);
    assert.ok(close > i);
    assert.ok(!(name in bodies));
    bodies[name] = sql.slice(open.end, ts[close].start);
    i = close + 1;
    if (ts[i].text !== ',') break;
    i++;
  }
  return { bodies, final: sql.slice(ts[i].start) };
}

function restore(sql) {
  const { bodies, final } = stages(sql), used = new Set();
  function inline(body, active = []) {
    const ts = scan(body), edits = [];
    for (let i = 0; i < ts.length - 1; i++) {
      if (!['from', 'join'].includes(ts[i].text.toLowerCase())) continue;
      const name = ts[i + 1].text.toLowerCase();
      if (!(name in bodies)) continue;
      if (active.includes(name)) throw Error('Recursive CTE: ' + name);
      used.add(name);
      edits.push({ start: ts[i + 1].start, end: ts[i + 1].end, value: '(' + inline(bodies[name], [...active, name]) + ')' });
    }
    for (const e of edits.reverse()) body = body.slice(0, e.start) + e.value + body.slice(e.end);
    return body;
  }
  const original = inline(final);
  assert.deepEqual([...used].sort(), Object.keys(bodies).sort(), 'every CTE must enter the output');
  return original;
}

test('all assembled tokens, field order, frozen hash and generated SQL agree', () => {
  const sql = render();
  assert.deepEqual(tokens(restore(sql)), tokens(source));
  assert.equal(read('完整SQL.sql'), sql);
  assert.deepEqual(parse(stages(sql).final).fields.map(tokens), parse(source).fields.map(tokens));
  assert.equal(parse(source).fields.length, 82);
  assert.equal(createHash('sha256').update(source).digest('hex'), JSON.parse(read('证据索引.json')).rawSha256);
});

test('changing a fee, date, branch order condition or JOIN fails full-query equality', () => {
  const sql = render();
  for (const [before, after] of [
    ["coalesce(s_cr.commission_rate,c_cr.commission_rate)", 'coalesce(s_cr.commission_rate,c_cr.commission_rate,0)'],
    ["cc.busi_date = info.Strt_Pric_Date", 'cc.busi_date = det.busi_date'],
    ["('RISKY','AIRBAGX')", "('RISKY','AIRBAGX','AIRBAG')"],
    ["inner join (", 'left join ('],
  ]) {
    assert.ok(sql.includes(before));
    assert.notDeepEqual(tokens(restore(sql.replace(before, after))), tokens(source));
  }
});

test('includes reject path escape, non-SQL, circular and empty input', () => {
  for (const name of ['../118141_交叉销售收入/完整SQL.sql', 'README.md']) assert.throws(() => expand(name, () => 'SELECT 1'));
  assert.throws(() => expand('00_主脚本.sql', () => '-- @include 00_主脚本.sql'), /Circular/);
  assert.throws(() => expand('00_主脚本.sql', () => ''), /empty/);
});

test('all walkthrough links resolve', () => {
  for (const name of readdirSync(root).filter(n => n.endsWith('.md'))) {
    for (const [, link] of read(name).matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/i.test(link)) continue;
      assert.ok(existsSync(resolve(root, decodeURIComponent(link.split('#')[0]))), name + ' → ' + link);
    }
  }
});

// Only these documented SQL adaptations are used; no Hive query is executed.
function adapt(sql) {
  return scan(sql).map(t => t.text).join(' ')
    .replaceAll('! =', '!=').replaceAll('< >', '<>').replaceAll('< =', '<=').replaceAll('> =', '>=')
    .replaceAll('${yyyy-MM-dd}', '2026-09-21').replaceAll('${yyyy}', '2026')
    .replace(/default\s*\.\s*gfgreatest/gi, 'gfgreatest');
}

function withDb(action) {
  const db = new DatabaseSync(':memory:');
  db.function('if', (c, a, b) => c ? a : b);
  db.function('gfgreatest', (a, b) => a === null || b === null ? null : Math.max(Number(a), Number(b)));
  db.function('concat', (a, b) => a === null || b === null ? null : String(a) + String(b));
  db.function('quarter', s => s === null ? null : Math.ceil(Number(s.slice(5, 7)) / 3));
  db.function('unix_timestamp', () => 1790000000);
  db.function('from_unixtime', { varargs: true }, () => '2026-09-21 12:00:00');
  try { return action(db); } finally { db.close(); }
}

function createRows(db, name, cols, rows) {
  db.exec('CREATE TABLE ' + name + ' (' + cols.map(c => '"' + c + '"').join(',') + ')');
  const insert = db.prepare('INSERT INTO ' + name + ' VALUES (' + cols.map(() => '?').join(',') + ')');
  for (const row of rows) insert.run(...cols.map(c => row[c] ?? null));
}

const days = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'];
function fixture(change = {}) {
  return withDb(db => {
    const { bodies, final } = stages(render()), first = parse(bodies.contract_day_income);
    const select = 'SELECT ' + first.fields.join(',\n');
    const refs = new Map(), ts = scan(select);
    for (let i = 0; i < ts.length - 2; i++) {
      if (ts[i + 1].text !== '.') continue;
      const alias = ts[i].text.toLowerCase(), column = ts[i + 2].text.toLowerCase();
      if (!refs.has(alias)) refs.set(alias, new Set());
      refs.get(alias).add(column);
    }
    for (const c of ['ddct_ptrn', 'init_marg_prop', 'base_marg_rate']) refs.get('info').add(c);
    const info = {
      agt_id: 'HK_OPT_DEMO', busi_type: 'OPTION', hk_contr_type_cd: 'OPTION_STOCK', hk_undrl_type: 'EQUITY',
      src_contr_type: 'NORMAL', grp_id: '01', strt_pric_date: days[0], end_pric_date: days[2],
      early_term_date: null, init_nom_prin: 3650000, cny_ex_rate: 1, ...change.info,
    };
    const aliases = [...refs.keys()];
    for (const [alias, cols] of refs) {
      const rows = days.map((date, i) => ({
        ...({
          info,
          det: { busi_date: date, dyna_nom_prin: [3650000, 3650000, 3650000, 0][i] },
          m: { intro_oper_user_id: 'INTRO', inr_org_id_1: '1234', allo_prop_1: 0.7, allo_prop_2: 0.3, allo_prop_3: 0 },
          s_sp: { spread_calculation: 'ANNUALIZED', annualized_spread: 0.006, absolute_spread: 0.006 },
          s_ba: { base_calculation: 'ANNUALIZED', base_award_rate: 0.004, additional_reward: 999 },
          s_cr: { commission_rate: 0.001 },
          c_sp: {}, c_ba: {}, c_cr: {}, di: {}, mid: {}, evt: {}, cc: {},
        }[alias]),
        ...(typeof change[alias] === 'function' ? change[alias](i) : change[alias]),
        fixture_day: i,
      }));
      createRows(db, 'input_' + alias, [...cols, 'fixture_day'], rows);
    }
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_ois");
    createRows(db, 'odata_n_ois.g_rev_hk_cross_income_reward',
      ['contract_no', 'expansion_dept_income', 'accounting_end_date', 'accounting_date', 'busi_date'],
      change.history ?? []);
    // Fixture keys pair already-matched rows; production matching remains intact and token checked above.
    const joined = aliases.map((a, i) => 'input_' + a + ' ' + a + (i ? ' ON ' + a + '.fixture_day=' + aliases[0] + '.fixture_day' : '')).join(' JOIN ');
    const firstSql = select + ' FROM ' + joined;
    const prefix = 'WITH contract_day_income AS (' + firstSql + '), adjusted_day_income AS (' + bodies.adjusted_day_income + '), allocated_day_income AS (' + bodies.allocated_day_income + ') ';
    return {
      raw: db.prepare(adapt(firstSql + ' ORDER BY det.busi_date')).all(),
      rows: db.prepare(adapt(prefix + final + ' ORDER BY Accrued_Date')).all(),
    };
  });
}

const amounts = rows => rows.map(r => r.Curr_Prvs_Sales_Income);
const near = (actual, expected) => {
  assert.equal(typeof actual, 'number', 'NULL is not a numeric zero');
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
};

test('one option reaches 100/day, 3450 final adjustment and 3650 report total', () => {
  const { raw, rows } = fixture();
  assert.deepEqual(amounts(raw), [100, 100, 100, 0]);
  assert.deepEqual(amounts(rows), [100, 100, 3450, 0]);
  assert.deepEqual(rows.map(r => r.Accum_prvs_sales_income), [100, 200, 3650, 3650]);
  near(rows[2].Accum_prvs_sales_income_1, 2555);
  near(rows[2].Accum_prvs_sales_income_2, 1095);
  assert.equal(rows[2].Init_Nom_Prin_Main, 1460000);
  assert.equal(rows[2].Init_Nom_Prin_Intro, 2190000);
  assert.equal(rows[2].Adtnl_Rwd, 999); // display does not add this reward to income
  assert.ok(!('Curr_Prvs_Sales_Income_1' in rows[2]));
  assert.equal(rows[2].busi_date, '2026-09-21');
});

test('early termination moves the option guarantee day; historical reward reduces replacement income', () => {
  assert.deepEqual(amounts(fixture({ info: { early_term_date: days[1] } }).rows), [100, 3550, 0, 0]);
  const history = [{ contract_no: 'HK_OPT_DEMO', expansion_dept_income: 1000, accounting_end_date: '2026-06-30', accounting_date: '202602', busi_date: '2026-09-21' }];
  const rows = fixture({ history }).rows;
  assert.deepEqual(amounts(rows), [100, 100, 2450, 0]);
  assert.equal(rows[2].Accum_prvs_sales_income, 2650);
  assert.equal(fixture({ history: [{ ...history[0], accounting_end_date: days[2] }] }).rows[2].Curr_Prvs_Sales_Income, 3450);
});

test('ordinary option annual/absolute combinations use actual CASE before any guarantee', () => {
  for (const [spread, base, expected] of [
    ['ANNUALIZED', 'ANNUALIZED', [100, 100, 100, 0]],
    ['ANNUALIZED', 'ABSOLUTE', [14660, 60, 60, 0]],
    ['ABSOLUTE', 'ANNUALIZED', [21940, 40, 40, 0]],
    ['ABSOLUTE', 'ABSOLUTE', [36500, 0, 0, 0]],
  ]) assert.deepEqual(amounts(fixture({ s_sp: { spread_calculation: spread }, s_ba: { base_calculation: base } }).raw), expected);
});

const trs = {
  info: { agt_id: 'HK_TRS_DEMO', cutp_pty_id: 'HK_CLIENT_DEMO', busi_type: 'TRS', hk_contr_type_cd: 'N_CROSS_SWAP', src_contr_type: 'N_CROSS_SWAP', grp_id: '02' },
  det: i => ({ dyna_nom_prin: [3650000, 2920000, 1825000, 0][i] }),
  evt: i => ({ occu_amt: i === 1 ? 365000 : null }),
  c_cr: { commission_rate: 0.002 },
  c_ba: { base_calculation: 'ANNUALIZED', base_award_rate: 0.004 },
};

test('HK_TRS_DEMO carries event commission through all income and output stages', () => {
  const { raw, rows } = fixture(trs);
  assert.deepEqual(amounts(raw), [3750, 445, 50, 0]);
  assert.deepEqual(amounts(rows), [3750, 445, 50, 0]);
  assert.deepEqual(rows.map(r => r.Accum_prvs_sales_income), [3750, 4195, 4245, 4245]);
  near(rows[2].Accum_prvs_sales_income_1, 2971.5);
  near(rows[2].Accum_prvs_sales_income_2, 1273.5);
  assert.equal(rows[2].Absl_Nom_Prin, 0);
  assert.equal(rows[2].Accum_Absl_Nom_Prin, 8395000); // original field repeats cumulative dynamic principal
});

test('TRS has all four annual/absolute combinations; commission remains transaction-based', () => {
  for (const [spread, base, expected] of [
    ['ANNUALIZED', 'ANNUALIZED', [3750, 445, 50, 0]],
    ['ANNUALIZED', 'ABSOLUTE', [18310, 413, 30, 0]],
    ['ABSOLUTE', 'ANNUALIZED', [25590, 397, 20, 0]],
    ['ABSOLUTE', 'ABSOLUTE', [40150, 365, 0, 0]],
  ]) assert.deepEqual(amounts(fixture({ ...trs, s_sp: { spread_calculation: spread }, s_ba: { base_calculation: base } }).rows), expected);
});

test('missing commission yields NULL daily TRS income, while cumulative output coalesces it to zero', () => {
  const empty = fixture({ ...trs, s_cr: { commission_rate: null }, c_cr: { commission_rate: null } });
  assert.deepEqual(amounts(empty.raw), [null, null, null, 0]);
  assert.deepEqual(amounts(empty.rows), [null, null, null, 0]);
  assert.deepEqual(empty.rows.map(r => r.Accum_prvs_sales_income), [0, 0, 0, 0]);
  assert.deepEqual(amounts(fixture({ ...trs, s_cr: { commission_rate: null }, c_cr: { commission_rate: 0.002 } }).rows), [7400, 810, 50, 0]);
});

test('rebate FEE_SWAP replaces only annual principal; its FX differs from event FX', () => {
  const fee = { ...trs, info: { ...trs.info, src_contr_type: 'FEE_SWAP', hk_contr_type_cd: 'FEE_SWAP', comp_usag_cd: 'REBATE_INTEREST', cny_ex_rate: 1 },
    di: { daily_base_amount: 3650000 }, mid: { mid_price: 0.5 } };
  assert.deepEqual(amounts(fixture(fee).rows), [3700, 415, 50, 0]);
  assert.deepEqual(amounts(fixture({ ...fee, mid: { mid_price: null } }).rows), [3750, 465, 100, 0]);
  assert.deepEqual(amounts(fixture({ ...fee, di: { daily_base_amount: null } }).rows), [null, null, null, 0]);
});

test('RISKY/AIRBAGX margin branches precede ordinary income and preserve missing-cost NULL', () => {
  const special = {
    info: { agt_id: 'HK_RISKY_DEMO', src_contr_type: 'RISKY', hk_contr_type_cd: 'OPTION_RISKY_AIRBAGX_CIR_STOCK', init_marg_prop: 0.2, base_marg_rate: 0.1 },
    det: i => ({ fee_rate: 0.106, dyna_nom_prin: i < 3 ? 3650000 : 0 }), cc: { capital_cost: 0.05 },
  };
  amounts(fixture(special).rows).forEach((value, i) => near(value, i < 3 ? 120 : 0));
  for (const value of amounts(fixture({ ...special, info: { ...special.info, marg_agt_id: 'MARGIN_DEMO' } }).rows).slice(0, 3)) near(value, 105);
  assert.deepEqual(amounts(fixture({ ...special, info: { ...special.info, ddct_ptrn: 'DEDUCTION' } }).rows), [0, 0, 0, 0]);
  assert.deepEqual(amounts(fixture({ ...special, cc: { capital_cost: null } }).rows), [null, null, null, null]);
  assert.deepEqual(amounts(fixture({ ...trs, info: { ...trs.info, src_contr_type: 'LONG_HOLD_SWAP', marg_agt_id: 'MARGIN_DEMO' } }).rows), [0, 0, 0, 0]);
  assert.deepEqual(amounts(fixture({ ...special, info: { ...special.info, src_contr_type: 'AIRBAG' } }).raw), [100, 100, 100, 0]);
});

test('annual spread default and display differ, while absent base type leaves income NULL', () => {
  const missingSpread = fixture({ s_sp: { spread_calculation: null, annualized_spread: null } });
  assert.deepEqual(amounts(missingSpread.raw), [40, 40, 40, 0]);
  assert.equal(missingSpread.rows[0].Annu_Sprd, '');
  assert.deepEqual(amounts(fixture({ s_ba: { base_calculation: '' } }).raw), [null, null, null, null]);
});

test('actual event UNION ALL and grouped amount feed the walkthrough amount', () => withDb(db => {
  const first = parse(stages(render()).bodies.contract_day_income);
  const eventSql = first.joins.find(j => j.alias === 'evt').body;
  db.exec("ATTACH DATABASE ':memory:' AS PDATA_N");
  createRows(db, 'PDATA_N.T05_OTC_COMP_DURA_CHG_EVT',
    ['otc_comp_agt_id', 'evt_date', 'src_id', 'src_tbl', 'evt_stat_cd', 'evt_type_cd', 'trd_date', 'chg_vol', 'mtch_full_pric', 'src_trd_dir_cd'], [
      { otc_comp_agt_id: 'HK_TRS_SOURCE', evt_date: days[1], src_id: 'E1', src_tbl: 'ODATA_N_TIT.D_TRD_TRS_EVENT', evt_stat_cd: '3', evt_type_cd: 'CLOSE_STOCKS' },
      { otc_comp_agt_id: 'HK_TRS_SOURCE', trd_date: days[1], chg_vol: 2650, mtch_full_pric: 100, src_tbl: 'ODATA_N_TIT.D_TRD_FAST_TRS_EVENT', src_trd_dir_cd: 'BUY', evt_type_cd: 'OPEN' },
      { otc_comp_agt_id: 'HK_TRS_SOURCE', evt_date: days[1], src_id: 'BAD', src_tbl: 'ODATA_N_TIT.D_TRD_TRS_EVENT', evt_stat_cd: '2', evt_type_cd: 'CLOSE_STOCKS' },
    ]);
  createRows(db, 'PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET', ['dura_chg_src_id', 'swap_comp_agt_id', 'occu_qty', 'pric', 'src_tbl'], [
    { dura_chg_src_id: 'E1', swap_comp_agt_id: 'HK_TRS_SOURCE', occu_qty: -1000, pric: 100, src_tbl: 'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL' },
    { dura_chg_src_id: 'BAD', swap_comp_agt_id: 'HK_TRS_SOURCE', occu_qty: 9999, pric: 100, src_tbl: 'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL' },
  ]);
  const rows = db.prepare(adapt(eventSql)).all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Occu_Amt, 365000);
  assert.equal(rows[0].Evt_Date, days[1]);
  // Feed the real delivered event-query result into the delivered income chain.
  const traced = fixture({ ...trs, evt: i => ({ occu_amt: i === 1 ? rows[0].Occu_Amt : null }) });
  assert.equal(traced.rows[1].Curr_Prvs_Sales_Income, 445);
  assert.equal(traced.rows[3].Accum_prvs_sales_income, 4245);
}));

test('actual info subquery classifies Hong Kong contracts and enforces snapshot/book/end gates', () => withDb(db => {
  const infoSql = parse(stages(render()).bodies.contract_day_income).joins.find(j => j.alias === 'info').body;
  const base = {
    busi_type: 'OPTION', src_undrl_type: 'EQUITY', src_contr_type: 'NORMAL', src_sub_contr_type: '',
    cntr: '', sler_cutp_pty_id: '', res_flag: '0', src_contr_type_desc: '源描述', futr_type: '',
    busi_date: '2026-09-21', early_term_date: null, end_pric_date: '2026-09-20', book_name: 'OTCHK-Option-ISDA',
  };
  const variants = [
    ['NORMAL', {}, 'OPTION_STOCK', 'EQUITY'],
    ['SNOWBALL', { src_contr_type: 'AUTOCALL', src_sub_contr_type: 'SNOWBALL' }, 'OPTION_OTHER_NONSTOCK', 'EQUITY'],
    ['NULL_SUBTYPE', { src_contr_type: 'AUTOCALL', src_sub_contr_type: null }, 'OPTION_OTHER_NONSTOCK', 'EQUITY'],
    ['INDEX', { src_undrl_type: 'INDEX', src_contr_type: 'ACCUMULATOR' }, 'OPTION_IDX_ETF', 'INDEX'],
    ['QIS', { src_undrl_type: 'QIS', cntr: 'OTCHK_QIS', sler_cutp_pty_id: 'TIT060-11613' }, 'OPTION_N_CROSS_QTF_STRG_IDX', 'OTHER'],
    ['RISKY', { src_contr_type: 'RISKY' }, 'OPTION_RISKY_AIRBAGX_CIR_STOCK', 'EQUITY'],
    ['AIRBAGX', { src_contr_type: 'AIRBAGX', res_flag: '1' }, 'OPTION_RISKY_AIRBAGX_PRI_STOCK', 'EQUITY'],
    ['HK_LONG', { busi_type: 'TRS', src_contr_type: 'HK_LONG_HOLD_SWAP' }, 'HK_LONG_HOLD_SWAP', 'EQUITY'],
    ['LONG', { busi_type: 'TRS', src_contr_type: 'LONG_HOLD_SWAP' }, 'TRS_OTHER_SWAP', 'EQUITY'],
    ['FUTURE', { futr_type: 'COMMODITY_FUTURE' }, 'OPTION_STOCK', 'COMMODITY_FUTURE'],
  ];
  const rows = variants.map(([agt_id, change]) => ({ ...base, ...change, agt_id }));
  rows.push({ ...base, agt_id: 'BAD_BOOK', book_name: 'OTHER' },
    { ...base, agt_id: 'OLD_END', early_term_date: '2025-11-30' },
    { ...base, agt_id: 'OLD_SNAPSHOT', busi_date: '2026-09-20' });
  db.exec("ATTACH DATABASE ':memory:' AS PDATA_N");
  createRows(db, 'PDATA_N.T98_OTC_DERI_COMP_SALE_INFO', [...Object.keys(base), 'agt_id'], rows);
  const actual = db.prepare(adapt(infoSql)).all();
  assert.equal(actual.length, variants.length);
  for (const [id, , contractType, underlying] of variants) {
    const row = actual.find(r => r.agt_id === id);
    assert.equal(row.HK_Contr_Type_Cd, contractType);
    assert.equal(row.HK_Undrl_Type, underlying);
  }
}));

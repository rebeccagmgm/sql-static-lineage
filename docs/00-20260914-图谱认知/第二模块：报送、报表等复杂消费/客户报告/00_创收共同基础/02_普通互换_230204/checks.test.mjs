import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render } from '../render.mjs';
import { scan, parse } from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const branch = '02_普通互换_230204';
const tokens = sql => scan(sql).map(token => token.text);
const core = () => parse(parse(render(branch)).joins[0].body);
const expression = name => core().fields.find(field => new RegExp(`\\bas\\s+${name}\\b`, 'i').test(field));
const fields = ['Curr_Rev', 'Trd_Cms', 'prop_ratio', 'End_Pric_Date', 'Is_Preterm_Flag'];
const expressions = () => fields.map(expression);
const flatten = sql => sql.replace(/\b(info|det|co|sh|evt|mid|fr|cr|ins|u|x)\.(\w+)/g, '$1_$2').replaceAll('default.gfgreatest', 'gfgreatest').replaceAll('default.gfleast', 'gfleast');
const columns = () => [...new Set(expressions().flatMap(sql => [...sql.matchAll(/\b(info|det|co|sh|evt|mid|fr|cr|ins|u|x)\.(\w+)/g)].map(m => `${m[1]}_${m[2]}`)))];
const isText = name => /(?:Agt_Clas_Cd|Src_Contr_Type|Src_Undrl_Type|Cros_Crrc_Type_Cd|Strt_Pric_Date|End_Pric_Date|Early_Term_Date|Cms_Mode_Cd|book_agt_id|undrl_clas|undrl_wd_cd|busi_date)$/.test(name);
const baseRow = overrides => ({
  info_Agt_Clas_Cd: 'TRS_SAC_OTC', info_Src_Contr_Type: 'S_CROSS_SWAP', info_Src_Undrl_Type: 'EQUITY',
  info_Cros_Crrc_Type_Cd: 'COMPOSITE', info_Strt_Pric_Date: '2026-09-16', info_End_Pric_Date: '2026-12-31', info_Early_Term_Date: null,
  info_Init_Nom_Prin: 3650000, info_fixed_rate: 0.06, info_Flot_Intrt_Ulmt: 0.08, info_Float_Base_Rate: 0.04, info_Intr_Marg: 0.01,
  info_book_agt_id: 'OTHER', info_undrl_wd_cd: '000905.SH', ins_undrl_clas: null,
  det_Dyna_Nom_Prin: 3650000, det_busi_date: '2026-09-16',
  co_FUND_COST_RATE: 0.035, co_MARGIN_FIXED_RATE: 0.005, co_COMMISSION_COST: 0.0002, co_SPREAD: 0.01, co_FIXED_RATE: 0.04,
  sh_Cms_Mode_Cd: '1', sh_Trd_Fee_Rate: 0.001, sh_Bgng_Vol: 100, sh_Peshr_Cms: 0.05, sh_Init_Rate: 2,
  evt_Nom_Prin_Chg_Delta: 0, evt_Occu_Qty: 0, evt_Divd_Tax_Amt: 0,
  mid_mid_price: 0.8, fr_intrt: 5, cr_ir: 2, u_Tdy_Yield: 1000, x_Tdy_Yield: 500,
  ...overrides,
});
const normal = () => [baseRow({}), baseRow({ det_busi_date: '2026-09-17', det_Dyna_Nom_Prin: 2920000, evt_Nom_Prin_Chg_Delta: 912500 })];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function sqlite() {
  const db = new DatabaseSync(':memory:');
  db.function('if', (condition, yes, no) => condition ? yes : no);
  // Available UDF evidence covers normal numeric greatest/least only.
  // Refuse NULL/non-numeric input instead of silently coercing NULL to JS zero.
  const numeric = fn => (...values) => {
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value))) throw Error('Unverified UDF NULL or invalid-number semantics');
    return fn(...values);
  };
  db.function('gfgreatest', { varargs: true }, numeric(Math.max));
  db.function('gfleast', { varargs: true }, numeric(Math.min));
  return db;
}
function evaluate(rows) {
  const db = sqlite();
  try {
    const names = columns();
    db.exec(`CREATE TABLE joined_rows (id INTEGER, ${names.map(n => `${n} ${isText(n) ? 'TEXT' : 'REAL'}`).join(',')})`);
    const put = db.prepare(`INSERT INTO joined_rows VALUES (${Array(names.length + 1).fill('?').join(',')})`);
    rows.forEach((r, i) => put.run(i, ...names.map(n => r[n] ?? null)));
    return db.prepare(`SELECT id, ${expressions().map(flatten).join(',')} FROM joined_rows ORDER BY id`).all().map(r => ({ ...r }));
  } finally { db.close(); }
}

test('current platform raw SHA, all assembled tokens, DDL and 74 output columns are unchanged', () => {
  assert.equal(createHash('sha256').update(source.raw).digest('hex'), '3d0a5c8f8245f796085c58fa2137df555d04ebaa819bc3c818c319677bcceafe');
  assert.deepEqual(tokens(render(branch)), tokens(source.query));
  assert.deepEqual(tokens(read('10_目标表结构.sql')), tokens(source.ddl));
  assert.equal(parse(render(branch)).fields.length, 74);
  assert.equal(core().fields.length, 74);
  assert.deepEqual(parse(render(branch)).fields.slice(-4).map(f => f.trim()), ['Agt_Clas_Cd', 'Src_Undrl_Type', 'busi_date', 'grp_id']);
  assert.equal(read('完整SQL.sql'), render(branch));
});

test('normal two-day contract: opening plus partial close to annual net revenue, gross commission stays separate', () => {
  const result = evaluate(normal());
  near(result[0].Curr_Rev, 3220); near(result[1].Curr_Rev, 824);
  near(result[0].Trd_Cms, 3650); near(result[1].Trd_Cms, 730);
  near(result.reduce((n, r) => n + r.Curr_Rev, 0) / 10000, 0.4044);
  near(result.reduce((n, r) => n + r.Trd_Cms, 0), 4380);
});

test('only commission cost rises: net commission floor zero, gross commission unchanged', () => {
  const result = evaluate(normal().map(r => ({ ...r, co_COMMISSION_COST: 0.0012 })));
  near(result[0].Curr_Rev, 300); near(result[1].Curr_Rev, 240);
  near(result[0].Trd_Cms + result[1].Trd_Cms, 4380);
});

test('opening wins over same-day events; per-share Init_Rate applies only at opening', () => {
  const row = baseRow({ evt_Nom_Prin_Chg_Delta: 999999 });
  near(evaluate([row])[0].Curr_Rev, 3220);
  const opening = baseRow({ sh_Cms_Mode_Cd: '10', evt_Occu_Qty: 100 });
  near(evaluate([opening])[0].Curr_Rev, 303.2);
  near(evaluate([opening])[0].Trd_Cms, 8);
  const closing = { ...opening, det_busi_date: '2026-09-17' };
  near(evaluate([closing])[0].Curr_Rev, 301.6);
  near(evaluate([closing])[0].Trd_Cms, 4);
});

test('FLEXO actual capped floating rate: center, floor and cap', () => {
  const row = baseRow({ info_Cros_Crrc_Type_Cd: 'FLEXO', det_busi_date: '2026-09-17' });
  near(evaluate([row])[0].Curr_Rev, 350);
  near(evaluate([{ ...row, fr_intrt: 1 }])[0].Curr_Rev, 150);
  near(evaluate([{ ...row, fr_intrt: 9 }])[0].Curr_Rev, 550);
  near(evaluate([{ ...row, cr_ir: null }])[0].Curr_Rev, 550);
  assert.throws(() => evaluate([{ ...row, fr_intrt: null }]));
});

test('long-hold spread adds converted dividend, not displayed gross commission', () => {
  const row = baseRow({ info_Src_Contr_Type: 'LONG_HOLD_SWAP', evt_Divd_Tax_Amt: 500 });
  near(evaluate([row])[0].Curr_Rev, 600);
  near(evaluate([{ ...row, evt_Divd_Tax_Amt: null }])[0].Curr_Rev, 200);
  near(evaluate([row])[0].Trd_Cms, 3650);
});

const indexRows = () => [
  baseRow({ info_Src_Contr_Type: 'INDEX_ENHANCE_SWAP', info_book_agt_id: '10016', det_Dyna_Nom_Prin: 2000000, mid_mid_price: 1 }),
  baseRow({ info_Src_Contr_Type: 'INDEX_ENHANCE_SWAP', info_book_agt_id: '10016', det_Dyna_Nom_Prin: 3000000, mid_mid_price: 1 }),
];
test('index pool 1000 plus upload 500 allocated only to eligible 10016 contracts', () => {
  assert.deepEqual(evaluate(indexRows()).map(r => r.Curr_Rev), [600, 900]);
  const otherBook = { ...indexRows()[1], info_book_agt_id: '10015' };
  assert.deepEqual(evaluate([...indexRows(), otherBook]).map(r => r.Curr_Rev), [600, 900, 0]);
  assert.deepEqual(evaluate(indexRows().map(r => ({ ...r, det_Dyna_Nom_Prin: 2000000 }))).map(r => r.Curr_Rev), [750, 750]);
  assert.deepEqual(evaluate(indexRows().map(r => ({ ...r, x_Tdy_Yield: null }))).map(r => r.Curr_Rev), [400, 600]);
});

test('empty underlying class is not a fallback; unqualified contract defaults zero; zero denominator remains unguarded', () => {
  assert.equal(evaluate([{ ...indexRows()[0], ins_undrl_clas: '' }])[0].Curr_Rev, 0);
  assert.equal(evaluate([baseRow({ info_Agt_Clas_Cd: 'OTHER' })])[0].Curr_Rev, 0);
  const income = expression('Curr_Rev');
  assert.match(tokens(income).join(''), /\/sum\(if\(/);
  assert.doesNotMatch(income, /nullif\s*\(/i);
  // Intentionally do not assign a production result to divide-by-zero inputs.
});

test('missing commission input invokes unverified UDF semantics rather than JS NULL coercion', () => {
  assert.throws(() => evaluate([baseRow({ co_COMMISSION_COST: null })]));
  near(evaluate([baseRow({ co_COMMISSION_COST: 0 })])[0].Curr_Rev, 3950);
});

test('latest holding row-number is per leg, not per contract', () => {
  const sh = core().joins.find(j => j.alias === 'sh').body;
  const db = sqlite();
  try {
    db.exec("ATTACH DATABASE ':memory:' AS PDATA_N; CREATE TABLE PDATA_N.T03_OTC_SWAP_COMP_HOLD_INFO (Swap_Comp_Agt_Id TEXT,Cms_Mode_Cd TEXT,Trd_Fee_Rate REAL,Peshr_Cms REAL,Bgng_Vol REAL,Init_Rate REAL,Leg_Glbl_Seq_No TEXT,busi_date TEXT,SRC_TBL TEXT)");
    const put = db.prepare('INSERT INTO PDATA_N.T03_OTC_SWAP_COMP_HOLD_INFO VALUES (?,?,?,?,?,?,?,?,?)');
    for (const [leg, date] of [['L1','2026-09-16'],['L1','2026-09-18'],['L2','2026-09-17']]) put.run('A','1',0.001,0.05,100,1,leg,date,'ODATA_N_TIT.D_POS_TRS_LEG_HIS_POS');
    assert.equal(db.prepare(`SELECT * FROM (${sh}) sh WHERE rk=1`).all().length, 2);
  } finally { db.close(); }
});

test('actual event aggregation converts close amounts and dividend separately', () => {
  const evt = core().joins.find(j => j.alias === 'evt').body;
  const db = sqlite();
  try {
    db.exec("ATTACH DATABASE ':memory:' AS PDATA_N; CREATE TABLE PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET (Swap_Comp_Agt_Id TEXT,Dura_Chg_Src_Id TEXT,Occu_Qty REAL,Pric REAL,rate REAL,Divd_Tax_Amt REAL,SRC_TBL TEXT); CREATE TABLE PDATA_N.T05_OTC_COMP_DURA_CHG_EVT (Src_Id TEXT,Otc_Comp_Agt_Id TEXT,Evt_Date TEXT,Evt_Stat_Cd TEXT,Evt_Type_Cd TEXT,src_tbl TEXT)");
    const detail = db.prepare('INSERT INTO PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET VALUES (?,?,?,?,?,?,?)');
    const event = db.prepare('INSERT INTO PDATA_N.T05_OTC_COMP_DURA_CHG_EVT VALUES (?,?,?,?,?,?)');
    detail.run('A','E1',-100,10,0.8,0,'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL');
    event.run('E1','A','2026-09-17','3','CLOSE_STOCKS','ODATA_N_TIT.D_TRD_TRS_EVENT');
    detail.run('A','E2',0,0,0.8,500,'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL');
    event.run('E2','A','2026-09-17','3','DIVIDEND_STOCKS','ODATA_N_TIT.D_TRD_TRS_EVENT');
    const row = db.prepare(evt).get();
    near(row.Nom_Prin_Chg_Delta, 800); near(row.Occu_Qty, 80); near(row.Divd_Tax_Amt, 400);
  } finally { db.close(); }
});

test('cost pivot missing item is zero, missing whole matching row is absent, type alias and effective boundaries retained', () => {
  const co = core().joins.find(j => j.alias === 'co');
  const parsed = parse(co.body);
  const pivotSql = `SELECT ${parsed.fields.join(',')} FROM expanded GROUP BY contract_type,busi_date`;
  const db = sqlite();
  try {
    db.exec('CREATE TABLE expanded (contract_type TEXT,coefficient_type TEXT,value REAL,busi_date TEXT)');
    db.prepare('INSERT INTO expanded VALUES (?,?,?,?)').run('S_CROSS_SWAP','FUND_COST_RATE',0.035,'2026-09-17');
    const result = db.prepare(pivotSql).all();
    near(result[0].COMMISSION_COST, 0);
    assert.equal(result.find(r => r.contract_type === 'LONG_HOLD_SWAP'), undefined);
    assert.match(co.text, /if\(info\.Src_Contr_Type = 'S_CROSS_OPTION_SWAP','S_CROSS_SWAP',info\.Src_Contr_Type\)/);
    const expanded = parse(parsed.joins[0].body);
    const intervalSql = expanded.joins[0].body.replaceAll('${yyyy-MM-dd}', '2026-09-22');
    const add = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(n)); return d.toISOString().slice(0,10); };
    db.function('date_add', add); db.function('date_sub', (date,n) => add(date,-n));
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_ois; CREATE TABLE odata_n_ois.g_client_revenue_coefficient (contract_type TEXT,coefficient_type TEXT,value REAL,effective_date TEXT,busi_date TEXT,is_del TEXT)");
    const put = db.prepare('INSERT INTO odata_n_ois.g_client_revenue_coefficient VALUES (?,?,?,?,?,?)');
    put.run('S_CROSS_SWAP','COMMISSION_COST',0.0002,'2026-01-01','2026-09-22','N');
    put.run('S_CROSS_SWAP','COMMISSION_COST',0.0012,'2026-09-17','2026-09-22','N');
    assert.deepEqual(db.prepare(intervalSql).all().map(r => [r.strt_date,r.end_Date]), [['2026-01-01','2026-09-16'],['2026-09-17','2026-09-22']]);
  } finally { db.close(); }
});

test('early end is display fallback, not a second income filter; whitespace-only changes still compare by tokens', () => {
  const row = baseRow({ info_Early_Term_Date: '2026-09-15' });
  assert.equal(evaluate([row])[0].End_Pric_Date, '2026-09-15');
  near(evaluate([row])[0].Curr_Rev, 3220);
  assert.equal(evaluate([{ ...row, info_Early_Term_Date: '' }])[0].End_Pric_Date, '');
  const actual = render(branch);
  for (const [before, after] of [["info.book_agt_id = '10016'", "info.book_agt_id = '10015'"], ['sh.Init_Rate *', '1 *'], ["and sh.rk = 1", "and sh.rk = 2"]]) {
    assert.ok(actual.includes(before));
    assert.notDeepEqual(tokens(actual.replace(before, after)), tokens(source.query));
  }
});

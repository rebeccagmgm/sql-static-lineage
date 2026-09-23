import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render } from '../render.mjs';
import { scan, parse } from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const branch = '02_持仓盈亏_227869';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const tokens = sql => scan(sql).map(token => token.text);
const reportDay = '2026-09-22';
const sourceDay = '2026-09-21';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

// Bounded local rows cross the actual SQL's >100000 snapshot gate.
// Most padding rows are not settlement records; the production gate counts them anyway.
function padding(db, count, day = sourceDay) {
  if (count <= 0) return;
  db.prepare(`WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v+1 FROM n WHERE v < ?)
    INSERT INTO odata_n_tit.d_value_report_cap_flow_p (busi_date,src_busi_date,vr_cap_type)
    SELECT 'h15',?,'其他' FROM n`).run(count,day);
}
function cash(db, { code = 'AAA', amount = 200, day = sourceDay, customer = 'P1', date = '2026-09-01', remark = 'C_A', type = '期权结算' } = {}) {
  db.prepare('INSERT INTO odata_n_tit.d_value_report_cap_flow_p VALUES (?,?,?,?,?,?,?,?)')
    .run(customer,date,type,remark,code,amount,'h15',day);
}
function fixture({ paddingCount = 99999 } = {}) {
  const db = new DatabaseSync(':memory:');
  // Compatibility for ordinary non-null ASCII fixture codes only; not all Hive array/collation behavior.
  db.aggregate('COLLECT_SET', { start: '[]', step: (state,value) => JSON.stringify([...new Set([...JSON.parse(state), ...(value == null ? [] : [value])])]) });
  db.function('SORT_ARRAY', value => value == null ? null : JSON.stringify(JSON.parse(value).sort()));
  db.function('CONCAT_WS', (separator,value) => value == null ? '' : JSON.parse(value).join(separator));
  db.exec(`ATTACH DATABASE ':memory:' AS odata_n_tit; ATTACH DATABASE ':memory:' AS DM_OTC_N;
    CREATE TABLE odata_n_tit.d_value_report_cap_flow_p (key_ctpty_id TEXT,vr_cap_busidate TEXT,vr_cap_type TEXT,vr_cap_remark TEXT,vr_cap_undrly_code TEXT,vr_cap_amount REAL,busi_date TEXT,src_busi_date TEXT);
    CREATE TABLE odata_n_tit.d_ref_counter_party_p (id TEXT,ctpty_legal_entity TEXT,busi_date TEXT);
    CREATE TABLE odata_n_tit.d_trd_otc_trade_p (key_otc_trade_id TEXT,internal_trade_id TEXT,busi_date TEXT);
    CREATE TABLE odata_n_tit.d_ref_option_deal_structure_p (key_otc_trade_id TEXT,underlying_wind_code TEXT,busi_date TEXT);
    CREATE TABLE odata_n_tit.d_pos_trs_leg_current_pos_p (KEY_LEG_ID TEXT,wind_code TEXT,busi_date TEXT);
    CREATE TABLE odata_n_tit.d_ref_trs_leg_p (KEY_LEG_ID TEXT,key_otc_trade_id TEXT,busi_date TEXT);
    CREATE TABLE odata_n_tit.d_value_report_element_result_pb (business_date TEXT,remark TEXT,business_key TEXT,element_id TEXT,result REAL,grp_id TEXT,busi_date TEXT);
    CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT (USCC TEXT,Cutp_Pty_Full_Name TEXT,Undrl_Wd_Cd TEXT,Undrl_Name TEXT,Dyna_Nom_Prin REAL,busi_date TEXT,grp_id TEXT,Accrued_Date TEXT);
    INSERT INTO odata_n_tit.d_ref_counter_party_p VALUES ('P1','示例客户','h15');
    INSERT INTO odata_n_tit.d_trd_otc_trade_p VALUES ('T_A','C_A','h15'),('T_B','C_B','h15');
    INSERT INTO odata_n_tit.d_ref_option_deal_structure_p VALUES ('T_A','AAA','h13'),('T_B','BBB','h13');`);
  db.exec('BEGIN');
  cash(db); cash(db,{ code:'BBB',amount:-500,remark:'C_B' }); padding(db,paddingCount);
  db.exec('COMMIT');
  const value = db.prepare('INSERT INTO odata_n_tit.d_value_report_element_result_pb VALUES (?,?,?,?,?,?,?)');
  value.run(`${reportDay} 12:00:00`,'P1','T_A','vr_opt_contractPV_eur',800,'h15',reportDay);
  value.run(`${reportDay} 12:00:00`,'P1','T_B','vr_trs_floatIncome_eur',100,'h15',reportDay);
  const hold = db.prepare('INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT VALUES (?,?,?,?,?,?,?,?)');
  for (const [code,name,amount] of [['AAA','标的甲',1000000],['BBB','标的乙',2000000],['CCC','标的丙',500000]]) hold.run('U001','示例客户',code,name,amount,reportDay,'01',reportDay);
  return db;
}
function query(db) {
  return db.prepare(render(branch).replaceAll('${yyyy-MM-dd}',reportDay)).all().map(row => ({...row})).sort((a,b) => `${a.underlying_code}/${a.underlying_name}/${a.company_id}`.localeCompare(`${b.underlying_code}/${b.underlying_name}/${b.company_id}`));
}
function withFixture(fn, options) { const db = fixture(options); try { fn(db); } finally { db.close(); } }

test('current raw SHA, assembled all tokens, DDL, full output and eight-column order are fixed', () => {
  assert.equal(createHash('sha256').update(source.raw).digest('hex'),'7d38abca86c3365a558589122e9e4cd64895cf221b074ba1142acb2f5a75a67b');
  assert.deepEqual(tokens(render(branch)),tokens(source.query));
  assert.deepEqual(tokens(read('07_目标表结构.sql')),tokens(source.ddl));
  assert.equal(read('完整SQL.sql'),render(branch));
  assert.deepEqual(parse(render(branch)).fields.map(field => field.trim()),['company_name','company_id','underlying_code','underlying_name','hold_amount','current_pnl','pnl_ratio','busi_date']);
});

test('full SELECT: settlements 200/-500 plus valuations 800/100 to 1000/-400 and 5/7,-2/7,0', () => withFixture(db => {
  const result = query(db);
  assert.deepEqual(result.map(r => [r.underlying_code,r.hold_amount,r.current_pnl]),[['AAA',100,0.1],['BBB',200,-0.04],['CCC',50,0]]);
  near(result[0].pnl_ratio,5/7); near(result[1].pnl_ratio,-2/7); near(result[2].pnl_ratio,0);
  assert.ok(result.every(r => r.company_id === 'U001' && r.busi_date === reportDay));
}));

test('UNION removes equal four-column settlement/valuation rows, not two independent contributions', () => withFixture(db => {
  db.exec("UPDATE odata_n_tit.d_value_report_element_result_pb SET result=200 WHERE business_key='T_A'");
  const result = query(db);
  near(result[0].current_pnl,0.02); near(result[0].pnl_ratio,1/3); near(result[1].pnl_ratio,-2/3);
}));

test('remove current AAA holding: its historical PnL disappears and remaining ratios recalculate', () => withFixture(db => {
  db.exec("DELETE FROM DM_OTC_N.OTC_REV_DAILY_RPT WHERE Undrl_Wd_Cd='AAA'");
  const result = query(db);
  assert.deepEqual(result.map(r=>r.underlying_code),['BBB','CCC']);
  near(result[0].pnl_ratio,-1); near(result[1].pnl_ratio,0);
}));

test('same code under two names repeats matching PnL and changes the name-only window', () => withFixture(db => {
  db.exec("INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT SELECT USCC,Cutp_Pty_Full_Name,Undrl_Wd_Cd,'甲的新名',Dyna_Nom_Prin,busi_date,grp_id,Accrued_Date FROM DM_OTC_N.OTC_REV_DAILY_RPT WHERE Undrl_Wd_Cd='AAA'");
  const result = query(db);
  assert.equal(result.filter(r=>r.underlying_code==='AAA').length,2);
  for (const r of result.filter(r=>r.underlying_code==='AAA')) near(r.pnl_ratio,5/12);
  near(result.find(r=>r.underlying_code==='BBB').pnl_ratio,-1/6);
}));

test('two USCCs with same name share denominator; renamed customer loses match and displays zero', () => withFixture(db => {
  db.exec("INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT SELECT 'U002',Cutp_Pty_Full_Name,Undrl_Wd_Cd,Undrl_Name,Dyna_Nom_Prin,busi_date,grp_id,Accrued_Date FROM DM_OTC_N.OTC_REV_DAILY_RPT WHERE Undrl_Wd_Cd='AAA'");
  const result = query(db);
  for (const r of result.filter(r=>r.underlying_code==='AAA')) near(r.pnl_ratio,5/12);
  db.exec("UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET Cutp_Pty_Full_Name='示例客户旧名'");
  assert.ok(query(db).every(r=>r.current_pnl===0 && r.pnl_ratio===0));
}));

test('missing customer mapping removes both raw branches but does not remove the holding rows', () => withFixture(db => {
  db.exec('DELETE FROM odata_n_tit.d_ref_counter_party_p');
  assert.equal(query(db).length,3);
  assert.ok(query(db).every(r=>r.current_pnl===0 && r.pnl_ratio===0));
}));

test('multi-underlying TRS string is not split back into individual held codes', () => withFixture(db => {
  db.exec("UPDATE odata_n_tit.d_value_report_cap_flow_p SET vr_cap_undrly_code=NULL WHERE vr_cap_remark='C_A'; DELETE FROM odata_n_tit.d_ref_option_deal_structure_p WHERE key_otc_trade_id='T_A'; INSERT INTO odata_n_tit.d_pos_trs_leg_current_pos_p VALUES ('L1','BBB','h13'),('L2','AAA','h13'),('L3','AAA','h13'); INSERT INTO odata_n_tit.d_ref_trs_leg_p VALUES ('L1','T_A','h13'),('L2','T_A','h13'),('L3','T_A','h13');");
  const result = query(db); near(result[0].current_pnl,0); near(result[1].current_pnl,-0.04);
  db.exec("UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET Undrl_Wd_Cd='AAA,BBB' WHERE Undrl_Wd_Cd='AAA'");
  near(query(db).find(r=>r.underlying_code==='AAA,BBB').current_pnl,0.1);
}));

test('cash code fallback is NULL-only; direct code beats option structure and empty code does not fall back', () => withFixture(db => {
  db.exec("UPDATE odata_n_tit.d_ref_option_deal_structure_p SET underlying_wind_code='WRONG' WHERE key_otc_trade_id='T_A'");
  near(query(db)[0].current_pnl,0.02); // Cash retains its own AAA; valuation maps to WRONG.
  db.exec("UPDATE odata_n_tit.d_value_report_cap_flow_p SET vr_cap_undrly_code='' WHERE vr_cap_remark='C_A'");
  near(query(db)[0].current_pnl,0);
}));

test('snapshot strict threshold rejects 100000 but admits 100001 rows before type filtering', () => {
  withFixture(db => { near(query(db)[0].current_pnl,0.08); },{paddingCount:99998});
  withFixture(db => { near(query(db)[0].current_pnl,0.1); },{paddingCount:99999});
});

test('snapshot chooses latest eligible date even after report day, not most rows; exactly-100000 is ignored', () => withFixture(db => {
  padding(db,1); // Old date now has 100002 rows, more than the later eligible date.
  padding(db,100000,'2026-09-23');
  near(query(db)[0].current_pnl,0.1); // New date has exactly 100000, not eligible.
  cash(db,{day:'2026-09-23',amount:777});
  near(query(db)[0].current_pnl,0.1577); // 777 settlement + 800 valuation.
  near(query(db)[1].current_pnl,0.01); // Old -500 settlement is no longer selected.
}));

test('substring date versus timestamp literal boundary is retained under SQLite string comparison', () => withFixture(db => {
  db.exec("DELETE FROM odata_n_tit.d_value_report_cap_flow_p WHERE vr_cap_remark IS NOT NULL");
  cash(db,{date:'2021-01-21 12:00:00',amount:1});
  cash(db,{date:'2021-01-22 12:00:00',amount:2});
  cash(db,{date:'2021-01-23 12:00:00',amount:3});
  near(query(db)[0].current_pnl,0.0803); // 800 valuation + only January 23 settlement.
  // This is not a claim about every production engine's implicit date coercion.
}));

test('settlement substring also admits 未结算; empty remark remains admissible with own underlying code', () => withFixture(db => {
  db.exec("UPDATE odata_n_tit.d_value_report_cap_flow_p SET vr_cap_type='未结算',vr_cap_remark='' WHERE vr_cap_undrly_code='AAA'");
  near(query(db)[0].current_pnl,0.1);
  db.exec("UPDATE odata_n_tit.d_value_report_cap_flow_p SET vr_cap_remark=NULL WHERE vr_cap_undrly_code='AAA'");
  near(query(db)[0].current_pnl,0.08);
}));

test('settlement remark required even with direct code; valuation element/date and holding day/branch filters matter', () => withFixture(db => {
  db.exec("UPDATE odata_n_tit.d_value_report_cap_flow_p SET vr_cap_remark=NULL WHERE vr_cap_undrly_code='AAA'");
  near(query(db)[0].current_pnl,0.08);
  db.exec("UPDATE odata_n_tit.d_value_report_element_result_pb SET element_id='OTHER' WHERE business_key='T_A'");
  near(query(db)[0].current_pnl,0);
  db.exec("UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET grp_id='04' WHERE Undrl_Wd_Cd='AAA'; UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET Accrued_Date='2026-09-21' WHERE Undrl_Wd_Cd='BBB'");
  assert.deepEqual(query(db).map(r=>r.underlying_code),['CCC']);
}));

test('zero, negative and NULL held amounts do not filter rows; all unmatched PnL yields zero ratios', () => withFixture(db => {
  db.exec("UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET Dyna_Nom_Prin=CASE Undrl_Wd_Cd WHEN 'AAA' THEN 0 WHEN 'BBB' THEN -10000 ELSE NULL END");
  assert.deepEqual(query(db).map(r=>r.hold_amount),[0,-1,null]);
  db.exec('DELETE FROM odata_n_tit.d_value_report_element_result_pb; DELETE FROM odata_n_tit.d_value_report_cap_flow_p');
  assert.ok(query(db).every(r=>r.current_pnl===0 && r.pnl_ratio===0));
}));

test('changing UNION, snapshot comparison, join or name-only window is caught by full token baseline', () => {
  const actual = render(branch);
  for (const [before,after] of [['    UNION\n','    UNION ALL\n'],['row_num > 100000','row_num >= 100000'],['PARTITION BY t.company_name','PARTITION BY t.company_id'],['t.underlying_code = pnl.wind_code','t.underlying_name = pnl.wind_code']]) {
    assert.ok(actual.includes(before));
    assert.notDeepEqual(tokens(actual.replace(before,after)),tokens(source.query));
  }
});

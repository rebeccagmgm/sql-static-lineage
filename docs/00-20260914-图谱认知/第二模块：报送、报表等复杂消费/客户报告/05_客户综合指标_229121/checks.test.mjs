import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {render} from './render.mjs';
import {scan,parse} from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const frozen=JSON.parse(read('99_冻结来源.json'));
const tokens=sql=>scan(sql).map(t=>t.text);
const today='2026-09-22',name='客户甲';
const report='DM_OTC_N.OTC_REV_DAILY_RPT',sale='pdata_n.T98_OTC_DERI_COMP_SALE_INFO';
const calls='pdata_n.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO';
const margins='pdata_n.T03_OTC_COMP_PERF_MARG_REF';
function put(db,table,row){const keys=Object.keys(row);db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(row));}
function rev(db,id,overrides={}){put(db,report,{Agt_Id:id,Inr_Seri_No:'I'+id,Cutp_Pty_Full_Name:name,USCC:'U001',Cutp_Pty_Id:'OIS1',busi_date:today,grp_id:'01',Accrued_Date:'2026-01-05',Strt_Pric_Date:'2026-01-05',End_Pric_Date:'2026-08-31',Busi_Type:'OPTION',Curr_Rev:0,Init_Nom_Prin:0,Dyna_Nom_Prin:0,trd_cms:0,...overrides});}
function saleRow(db,id,overrides={}){put(db,sale,{Agt_Id:id,Inr_Seri_No:'I'+id,Cutp_Pty_Full_Name:name,busi_date:today,grp_id:'01',Contr_Type_Desc:'欧式期权',Dyna_Nom_Prin:0,net_coll:0,...overrides});}
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec("ATTACH DATABASE ':memory:' AS DM_OTC_N; ATTACH DATABASE ':memory:' AS pdata_n;");
  // Restricted fixture adapter, not Hive certification: legal ISO dates and scalar strings only.
  db.function('concat',{varargs:true},(...v)=>v.some(x=>x===null)?null:v.join(''));
  db.aggregate('collect_set',{start:'[]',step:(s,v)=>JSON.stringify([...new Set([...JSON.parse(s),...(v===null?[]:[v])])])});
  db.aggregate('collect_list',{start:'[]',step:(s,v)=>JSON.stringify([...JSON.parse(s),...(v===null?[]:[v])])});
  db.function('concat_ws',(sep,arr)=>JSON.parse(arr).join(sep));
  db.function('last_day',value=>{const d=new Date(value+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,0);return d.toISOString().slice(0,10);});
  db.function('datediff',(a,b)=>(Date.parse(a)-Date.parse(b))/86400000);
  const schemas={
    [report]:'Agt_Id TEXT,Inr_Seri_No TEXT,Cutp_Pty_Full_Name TEXT,USCC TEXT,Cutp_Pty_Id TEXT,busi_date TEXT,grp_id TEXT,Accrued_Date TEXT,Strt_Pric_Date TEXT,Early_Term_Date TEXT,End_Pric_Date TEXT,Busi_Type TEXT,Curr_Rev REAL,Init_Nom_Prin REAL,Dyna_Nom_Prin REAL,trd_cms REAL,Src_Contr_Type_Desc TEXT,Agt_Clas_Cd TEXT,Src_Contr_Type TEXT,Src_Undrl_Type TEXT',
    [sale]:'Agt_Id TEXT,Inr_Seri_No TEXT,Cutp_Pty_Full_Name TEXT,busi_date TEXT,grp_id TEXT,Contr_Type_Desc TEXT,Src_Contr_Type_Desc TEXT,Dyna_Nom_Prin REAL,net_coll REAL',
    'pdata_n.T01_OTC_DERI_CUST':'Pty_Id TEXT,Oper_User_Id TEXT,busi_date TEXT,src_tbl TEXT',
    'pdata_n.T98_ORG_EMP_BASE_INFO':'Oa_User_Id TEXT,Emp_Name TEXT,busi_date TEXT',
    'pdata_n.T05_OTC_COMP_DURA_CHG_EVT':'Otc_Comp_Agt_Id TEXT,Nom_Prin_Chg_Delta REAL,src_tbl TEXT,Evt_Date TEXT,Evt_Type_Cd TEXT',
    'pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT':'Comb_Agt_Grp_ID TEXT,Dyna_Nom_Prin REAL,Marg_Perf_Prtc_Rati REAL,busi_date TEXT,src_tbl TEXT,Perf_Marg_Flag TEXT',
    'pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO':'Agt_Grp_Id TEXT,Cutp_Pty_Id TEXT,src_tbl TEXT,Comb_Compnt_Cd TEXT',
    'pdata_n.T01_PTY_RELA_H':'Pty_Id TEXT,Rela_Pty_Id TEXT,src_tbl TEXT,Strt_Date TEXT,End_Date TEXT',
    'pdata_n.T01_CORP_CUST':'PTY_ID TEXT,USCC TEXT,ORG_FULL_NAME_CH TEXT,busi_date TEXT,src_tbl TEXT',
    [margins]:'Comb_Agt_Grp_Id TEXT,Lcrrc_Dyna_Nom_Prin REAL,Bail_Apd_Marg_Line REAL,busi_date TEXT,src_tbl TEXT,Otc_Comp_Agt_Id TEXT,Enable_Perf_Marg_Type_Cd TEXT',
    'pdata_n.T01_PTY_LMT_H':'Pty_Id TEXT,Lmt REAL,Perm_Busi_Type TEXT,src_tbl TEXT,Strt_Date TEXT,End_Date TEXT,Pty_Lmt_Type_Cd TEXT',
    'pdata_n.T01_CUTP_PERF_MARG_PLAN_INFO':'Pty_Id TEXT,busi_date TEXT,src_tbl TEXT',
    'pdata_n.T01_PTY_NAME':'Pty_Id TEXT,Full_Name_En TEXT,Shor_Name_Ch TEXT,busi_date TEXT,src_tbl TEXT',
    [calls]:'Pty_Id TEXT,Defr_Days REAL,Perf_Marg_Date TEXT,Marg_Call_Amt REAL,busi_date TEXT,src_tbl TEXT',
    'DM_OTC_N.bi_otc_cust_tag':'company_name TEXT,busi_date TEXT,tag_name TEXT',
    'pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO':'Exp_Comp_No TEXT,Accum_Unrlz_Yield REAL,Accum_Rlz_Yield REAL,Swap_Comp_Leg_Type_Cd TEXT,busi_date TEXT,src_tbl TEXT'
  };
  for(const [table,columns] of Object.entries(schemas))db.exec(`CREATE TABLE ${table} (${columns})`);
  put(db,'pdata_n.T01_OTC_DERI_CUST',{Pty_Id:'OIS1',Oper_User_Id:'sales1',busi_date:today,src_tbl:'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'});
  put(db,'pdata_n.T98_ORG_EMP_BASE_INFO',{Oa_User_Id:'sales1',Emp_Name:'销售甲',busi_date:today});
  for(const [id,type,income,net] of [['E1','欧式香草',100,-100],['E2','欧式香草',-50,100],['G1','安全气囊',30,-100]]){
    rev(db,id,{Src_Contr_Type_Desc:type,Curr_Rev:income});saleRow(db,id,{net_coll:net});
  }
  const south={grp_id:'02',Busi_Type:'TRS',End_Pric_Date:'2027-12-31',Agt_Clas_Cd:'TRS_SAC_OTC',Src_Contr_Type:'S_CROSS_SWAP',Src_Undrl_Type:'EQUITY'};
  rev(db,'P',{...south,Accrued_Date:'2026-08-31',Strt_Pric_Date:'2026-01-01',Dyna_Nom_Prin:2000000,trd_cms:20});
  rev(db,'N',{...south,Accrued_Date:'2026-09-05',Strt_Pric_Date:'2026-09-05',Init_Nom_Prin:1000000,Dyna_Nom_Prin:1000000,trd_cms:30});
  rev(db,'K',{grp_id:'03',Busi_Type:'TRS',Accrued_Date:'2026-08-01',Strt_Pric_Date:'2026-01-01',End_Pric_Date:'2027-12-31',trd_cms:40});
  saleRow(db,'P',{grp_id:'02',Contr_Type_Desc:'南下跨境',Src_Contr_Type_Desc:'南下跨境',Dyna_Nom_Prin:2000000});
  saleRow(db,'B',{grp_id:'02',Contr_Type_Desc:'借券互换',Src_Contr_Type_Desc:'借券互换',Dyna_Nom_Prin:1000000});
  put(db,'pdata_n.T05_OTC_COMP_DURA_CHG_EVT',{Otc_Comp_Agt_Id:'IP',Nom_Prin_Chg_Delta:500000,src_tbl:'ODATA_N_TIT.D_TRD_TRS_EVENT',Evt_Date:'2026-09-15',Evt_Type_Cd:'CLOSE_STOCKS'});
  put(db,'pdata_n.T01_PTY_RELA_H',{Pty_Id:'TIT1',Rela_Pty_Id:'OIS1',src_tbl:'ODATA_N_TIT.D_REF_CTPTY_MAPPING',Strt_Date:'2025-01-01',End_Date:'9999-12-31'});
  put(db,'pdata_n.T01_CORP_CUST',{PTY_ID:'OIS1',USCC:'U001',ORG_FULL_NAME_CH:name,busi_date:today,src_tbl:'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'});
  for(const [bundle,principal,ratio,line] of [['B1',1000000,0.2,0.15],['B2',3000000,0.4,0.25]]){
    put(db,'pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO',{Agt_Grp_Id:bundle,Cutp_Pty_Id:'TIT1',src_tbl:'ODATA_N_TIT.D_TRD_BUNDLE_INFO',Comb_Compnt_Cd:'TRS'});
    put(db,'pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT',{Comb_Agt_Grp_ID:bundle,Dyna_Nom_Prin:principal,Marg_Perf_Prtc_Rati:ratio,busi_date:today,src_tbl:'ODATA_N_TIT.D_BUNDLE_MARGIN_DAILY_RESULT',Perf_Marg_Flag:'1'});
    put(db,margins,{Comb_Agt_Grp_Id:bundle,Lcrrc_Dyna_Nom_Prin:principal,Bail_Apd_Marg_Line:line,busi_date:today,src_tbl:'ODATA_N_TIT.D_BUNDLE_DAILY_CONTR_PARAM'});
  }
  for(const id of ['P','B'])put(db,margins,{Otc_Comp_Agt_Id:'I'+id,Enable_Perf_Marg_Type_Cd:'STATIC',busi_date:today,src_tbl:'ODATA_N_TIT.D_REF_OTC_CONTR_MARGIN_PARAM'});
  for(const [limit,type] of [[5000000,'OPTION'],[8000000,'TRS']])put(db,'pdata_n.T01_PTY_LMT_H',{Pty_Id:'TIT1',Lmt:limit,Perm_Busi_Type:type,src_tbl:'ODATA_N_TIT.D_RISK_CTPTY_LIMIT_THRESHOLD',Strt_Date:'2025-01-01',End_Date:'9999-12-31',Pty_Lmt_Type_Cd:'ADMINISTRATORLIMIT'});
  put(db,'pdata_n.T01_CUTP_PERF_MARG_PLAN_INFO',{Pty_Id:'TIT1',busi_date:today,src_tbl:'ODATA_N_TIT.D_MARGIN_PLAN'});
  put(db,'pdata_n.T01_PTY_NAME',{Pty_Id:'TIT1',Full_Name_En:name,Shor_Name_Ch:'产品甲简称',busi_date:today,src_tbl:'ODATA_N_TIT.D_REF_COUNTER_PARTY'});
  for(const [day,duration,amount] of [['01',1,10000],['02',2,20000],['03',2,20000],['04',3,30000]])put(db,calls,{Pty_Id:'TIT1',Defr_Days:duration,Perf_Marg_Date:'2026-09-'+day,Marg_Call_Amt:amount,busi_date:today,src_tbl:'ODATA_N_TIT.G_MARGIN_CALL_SETTING'});
  put(db,'DM_OTC_N.bi_otc_cust_tag',{company_name:name,busi_date:today,tag_name:'有垫资'});
  for(const [id,leg,unreal,real] of [['P','FLOAT_LEG_TYPE',100,20],['P','FIXED_LEG_TYPE',200,30],['B','FIXED_LEG_TYPE',50,10]])put(db,'pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO',{Exp_Comp_No:id,Accum_Unrlz_Yield:unreal,Accum_Rlz_Yield:real,Swap_Comp_Leg_Type_Cd:leg,busi_date:today,src_tbl:'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION'});
  return db;
}
function adapt(source){
  let sql=source.replaceAll('${yyyy-MM-dd}',today).replaceAll('${yyyy,-1y}','2025').replaceAll('${yyyy-MM}','2026-09').replaceAll('${yyyy-MM-dd,-1M}','2026-08-22');
  // Hive / is non-integer division. Coerce each original slash, never replace the business expression.
  const slashes=scan(sql).filter(t=>t.text==='/');
  for(const token of slashes.reverse())sql=sql.slice(0,token.start)+'* 1.0 /'+sql.slice(token.end);
  return sql;
}
function query(db){return db.prepare(adapt(render())).all().map(r=>({...r}));}
function run(fn){const db=fixture();try{fn(db);}finally{db.close();}}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);
function ratios(text){return Object.fromEntries(text.split(',').map(x=>{const [k,v]=x.split(':');return[k,Number(v)];}));}

test('frozen SHA, all query/DDL tokens, 26-column order and assembled output match',()=>{
  assert.equal(createHash('sha256').update(frozen.raw).digest('hex'),'7e03a671da18c7285f189a0d37a534b4f8e3d68c0a0335469b78435a4bb0324c');
  assert.deepEqual(tokens(render()),tokens(frozen.query));
  assert.deepEqual(tokens(read('15_目标表结构.sql')),tokens(frozen.ddl));
  assert.deepEqual(parse(render()).fields.map(f=>f.trim()),['company_name','company_id','contact_sales','sales_login','cust_hold_win_rate','cust_win_rate','margin_ratio','margin_call_line','margin_grade','risk_test_data','outst_margin_amount','used_quota','approved_quota','approved_busi_type','margin_call_rate','cust_advance_info','credit_measure','cust_satisfaction_score','cust_satisfaction_feedback','swap_turnover_rate','swap_new_principal','swap_outst_month_end','swap_platform_fee','swap_bond_interest','swap_commission','busi_date']);
  assert.equal(read('完整SQL.sql'),render());
});
test('full SELECT: one customer through all 13 inputs to all 26 outputs',()=>run(db=>{
  const rows=query(db);assert.equal(rows.length,1);const r=rows[0];
  assert.equal(r.company_name,name);assert.equal(r.company_id,'U001');assert.equal(r.contact_sales,'销售甲');assert.equal(r.sales_login,'sales1');
  near(r.cust_hold_win_rate,2/3);for(const value of Object.values(ratios(r.cust_win_rate)))near(value,1/3);
  assert.deepEqual(new Set(Object.keys(ratios(r.cust_win_rate))),new Set(['欧式期权','安全气囊']));
  near(r.margin_ratio,.35);near(r.margin_call_line,.225);assert.equal(r.outst_margin_amount,300);assert.equal(r.used_quota,300);assert.equal(r.approved_quota,800);
  assert.deepEqual(new Set(r.approved_busi_type.split(';')),new Set(['OPTION','TRS']));near(r.margin_call_rate,.625);
  // SQLite/Hive numeric-to-string rendering differs; assert rounded numerical content, not decimal padding.
  assert.match(r.cust_advance_info,/2026年第三季度/);assert.match(r.cust_advance_info,/平均每周约0(?:\.0)?次/);assert.match(r.cust_advance_info,/单次时长2(?:\.0)?天/);assert.match(r.cust_advance_info,/集中在1(?:\.0)?万元/);
  assert.equal(r.credit_measure,'产品甲简称');near(r.swap_turnover_rate,.75);assert.equal(r.swap_new_principal,100);near(r.swap_outst_month_end,.02);near(r.swap_platform_fee,.035);near(r.swap_bond_interest,.006);near(r.swap_commission,.009);assert.equal(r.busi_date,today);
  for(const field of ['margin_grade','risk_test_data','cust_satisfaction_score','cust_satisfaction_feedback'])assert.equal(r[field],null);
}));
test('contract revenue sums before positive test; early termination overrides later maturity; no group filter in t1',()=>run(db=>{
  rev(db,'E1',{Curr_Rev:-150,Accrued_Date:'2026-02-01',Src_Contr_Type_Desc:'欧式香草'});near(query(db)[0].cust_hold_win_rate,1/3);
  rev(db,'X',{grp_id:'04',Curr_Rev:10,Early_Term_Date:today,End_Pric_Date:'2027-01-01'});near(query(db)[0].cust_hold_win_rate,2/4);
  db.exec(`UPDATE ${report} SET Curr_Rev=NULL WHERE Agt_Id='G1'`);near(query(db)[0].cust_hold_win_rate,1/4);
}));
test('option denominator is both categories and joined rows, not distinct contracts',()=>run(db=>{
  saleRow(db,'E1',{net_coll:-100});const ratio=ratios(query(db)[0].cust_win_rate);near(ratio['欧式期权'],2/4);near(ratio['安全气囊'],1/4);
  db.exec(`UPDATE ${sale} SET net_coll=NULL WHERE Agt_Id='G1'`);near(ratios(query(db)[0].cust_win_rate)['安全气囊'],0);
}));
test('same USCC with different names expands output via t1 identity; NULL USCC cannot attach ratios',()=>run(db=>{
  rev(db,'X',{Cutp_Pty_Full_Name:'客户甲新名',Curr_Rev:10});assert.equal(query(db).length,4);
  db.exec(`UPDATE ${report} SET USCC=NULL WHERE Cutp_Pty_Full_Name='客户甲新名'`);
  const renamed=query(db).find(r=>r.company_name==='客户甲新名');assert.equal(renamed.cust_hold_win_rate,null);assert.equal(renamed.cust_win_rate,null);
}));
test('NULL margin ratio keeps weight but NULL call line is removed before weight',()=>run(db=>{
  db.exec("UPDATE pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT SET Marg_Perf_Prtc_Rati=NULL WHERE Comb_Agt_Grp_ID='B2'");
  db.exec(`UPDATE ${margins} SET Bail_Apd_Marg_Line=NULL WHERE Comb_Agt_Grp_ID='B2'`);
  const r=query(db)[0];near(r.margin_ratio,.05);near(r.margin_call_line,.15);
}));
test('duplicate bundle mapping changes weights; effective end is exclusive',()=>run(db=>{
  db.exec("INSERT INTO pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO SELECT * FROM pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO WHERE Agt_Grp_Id='B1'");
  const r=query(db)[0];near(r.margin_ratio,.32);near(r.margin_call_line,.21);
  db.exec(`UPDATE pdata_n.T01_PTY_RELA_H SET End_Date='${today}'`);const missing=query(db)[0];assert.equal(missing.margin_ratio,null);assert.equal(missing.margin_call_line,null);assert.equal(missing.approved_quota,null);
}));
test('MAX quota and duplicated margin parameters differ from independent used exposure',()=>run(db=>{
  db.exec(`INSERT INTO ${margins} SELECT * FROM ${margins} WHERE Otc_Comp_Agt_Id='IP'`);
  const r=query(db)[0];assert.equal(r.approved_quota,800);assert.equal(r.outst_margin_amount,500);assert.equal(r.used_quota,500);
  db.exec(`DELETE FROM ${margins} WHERE Otc_Comp_Agt_Id IS NOT NULL`);assert.equal(query(db)[0].used_quota,0);
}));
test('turnover excludes out-of-month events and event-only contracts, retains negative event sign',()=>run(db=>{
  for(const [contract,date] of [['MISSING','2026-09-10'],['IP','2026-08-31'],['IP','2026-09-23']])put(db,'pdata_n.T05_OTC_COMP_DURA_CHG_EVT',{Otc_Comp_Agt_Id:contract,Nom_Prin_Chg_Delta:999999,src_tbl:'ODATA_N_TIT.D_TRD_TRS_EVENT',Evt_Date:date,Evt_Type_Cd:'CLOSE_STOCKS'});
  near(query(db)[0].swap_turnover_rate,.75);
  db.exec("UPDATE pdata_n.T05_OTC_COMP_DURA_CHG_EVT SET Nom_Prin_Chg_Delta=-500000 WHERE Evt_Date='2026-09-15'");near(query(db)[0].swap_turnover_rate,.25);
  db.exec(`DELETE FROM ${report} WHERE Accrued_Date='2026-08-31'`);assert.equal(query(db)[0].swap_turnover_rate,null); // SQLite zero division only, not Hive certification.
}));
test('fee type not leg type controls bucket; missing one addend makes that row NULL; current snapshot only',()=>run(db=>{
  db.exec("UPDATE pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO SET Swap_Comp_Leg_Type_Cd='FIXED_LEG_TYPE'");near(query(db)[0].swap_platform_fee,.035);
  db.exec("UPDATE pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO SET Accum_Unrlz_Yield=NULL WHERE Accum_Rlz_Yield=20");near(query(db)[0].swap_platform_fee,.023);
  db.exec(`UPDATE pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO SET busi_date='2026-09-21'`);assert.equal(query(db)[0].swap_platform_fee,null);
}));
test('commission subset selects grp03 or qualifying southbound grp02, not every TRS',()=>run(db=>{
  rev(db,'EXCLUDED',{grp_id:'02',Busi_Type:'TRS',trd_cms:9999,End_Pric_Date:'2027-01-01'});near(query(db)[0].swap_commission,.009);
  db.exec(`UPDATE ${report} SET Src_Undrl_Type='INDEX' WHERE Agt_Id='N'`);near(query(db)[0].swap_commission,.006);
  db.exec(`UPDATE ${report} SET Src_Contr_Type='S_CROSS_OPTION_SWAP' WHERE Agt_Id='N'`);near(query(db)[0].swap_commission,.009);
  db.exec(`UPDATE ${report} SET trd_cms=NULL WHERE Agt_Id='K'`);near(query(db)[0].swap_commission,.005);
}));
test('timely calls use sums of days; zero-day input adds no denominator; templates require tag but prove no external review',()=>run(db=>{
  near(query(db)[0].margin_call_rate,5/8);
  put(db,calls,{Pty_Id:'TIT1',Defr_Days:0,Perf_Marg_Date:'2026-09-05',Marg_Call_Amt:0,busi_date:today,src_tbl:'ODATA_N_TIT.G_MARGIN_CALL_SETTING'});near(query(db)[0].margin_call_rate,5/8);
  assert.match(query(db)[0].cust_advance_info,/根据托管行资金流水及券商对账单回溯/);
  db.exec('DELETE FROM DM_OTC_N.bi_otc_cust_tag');assert.equal(query(db)[0].cust_advance_info,null);
}));
test('report snapshot and previous-year boundary govern base; four placeholders stay NULL',()=>run(db=>{
  rev(db,'OLD',{Cutp_Pty_Full_Name:'旧客户',USCC:'OLD',busi_date:'2026-09-21'});
  rev(db,'EARLY',{Cutp_Pty_Full_Name:'早客户',USCC:'EARLY',Accrued_Date:'2024-12-31'});assert.equal(query(db).length,1);
  rev(db,'EDGE',{Cutp_Pty_Full_Name:'边界客户',USCC:'EDGE',Accrued_Date:'2025-01-01',End_Pric_Date:'2027-01-01'});assert.equal(query(db).length,2);
}));
test('include expander rejects traversal, cycles, and empty input',()=>{
  assert.throws(()=>render(()=> '-- @include ../outside.sql'),/flat/);
  assert.throws(()=>render(()=> '-- @include 00_主脚本.sql'),/Circular/);
  assert.throws(()=>render(()=> ''),/empty/);
});
test('main script owns actual 12 LEFT JOINs and both matching keys, modules supply query bodies',()=>{
  const main=read('00_主脚本.sql');
  assert.equal((main.match(/^left join \(/gm)??[]).length,12);
  assert.equal((main.match(/on t0\.company_id = /g)??[]).length,5);
  assert.equal((main.match(/on t0\.company_name = /g)??[]).length,7);
  for(const file of ['01_客户与销售.sql','02_结束合约创收胜率.sql','03_期权净收胜率.sql','04_互换月换手.sql','05_履保比例.sql','06_追保线.sql','07_获批额度.sql','08_履保规模.sql','09_增信资料.sql','10_追保及时率.sql','11_垫资文字.sql','12_平台费与券息.sql','13_互换佣金.sql']){
    assert.equal(tokens(read(file))[0].toLowerCase(),'select',file+' must be a query body');
    assert.ok(!/on t0\./.test(read(file)),file+' cannot hide its outer match key');
  }
});
test('nested stages are live includes and the actual advance statistics produce unrounded inputs',()=>run(db=>{
  for(const [parent,child] of [['03_期权净收胜率.sql','03.1_期权样本与类别计数.sql'],['05_履保比例.sql','05.1_履保身份与加权明细.sql'],['06_追保线.sql','06.1_追保身份与加权明细.sql'],['11_垫资文字.sql','11.1_垫资统计.sql']]){
    assert.ok(read(parent).includes('-- @include '+child));
    assert.throws(()=>render(file=>file===child?'':read(file)),/empty/);
  }
  const row=db.prepare(adapt(read('11.1_垫资统计.sql'))).get();
  assert.equal(row.freq_quarter,'2026年第三季度');near(row.weekly_freq,21/630);near(row.avg_duration,7/3);near(row.daily_amt_wan,1);
}));
test('all NULL margins stay NULL; nonpositive principal is filtered rather than given a weight',()=>run(db=>{
  db.exec('UPDATE pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT SET Marg_Perf_Prtc_Rati=NULL');assert.equal(query(db)[0].margin_ratio,null);
  db.exec(`UPDATE ${margins} SET Lcrrc_Dyna_Nom_Prin=0 WHERE Comb_Agt_Grp_Id='B2'`);near(query(db)[0].margin_call_line,.15);
  db.exec(`UPDATE ${margins} SET Lcrrc_Dyna_Nom_Prin=-1 WHERE Comb_Agt_Grp_Id='B1'`);assert.equal(query(db)[0].margin_call_line,null);
}));
test('fee uses Exp_Comp_No to match Agt_Id, NULL addends and entirely missing fee differ from category zero',()=>run(db=>{
  db.exec("UPDATE pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO SET Exp_Comp_No='IP' WHERE Exp_Comp_No='P'");
  const r=query(db)[0];assert.equal(r.swap_platform_fee,0);near(r.swap_bond_interest,.006);
  db.exec("DELETE FROM pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO");assert.equal(query(db)[0].swap_platform_fee,null);
}));
test('advance tags are not deduplicated and a NULL amount yields adapter NULL text, not proven narrative',()=>run(db=>{
  put(db,'DM_OTC_N.bi_otc_cust_tag',{company_name:name,busi_date:today,tag_name:'有垫资'});assert.equal(query(db).length,2);
  db.exec(`UPDATE ${calls} SET Marg_Call_Amt=NULL`);assert.ok(query(db).every(r=>r.cust_advance_info===null));
}));

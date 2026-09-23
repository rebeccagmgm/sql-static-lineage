import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render } from '../render.mjs';
import { scan, parse } from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const branch = '02_部门协同_232556';
const read = name => readFileSync(new URL(name, import.meta.url),'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const tokens = sql => scan(sql).map(token => token.text);
const today = '2026-09-22';
function reward(db,name,dept,amount,quarter='202603',sourceTable='ODATA_N_OIS.G_CROSS_INCOME_REWARD',snapshot=today) {
  db.prepare('INSERT INTO pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM VALUES (?,?,?,?,?,?)').run(name,dept,amount,quarter,sourceTable,snapshot);
}
function index(db,product,amount,quarter='2026Q3',tag='tag999999999',office='G_OFFICE') {
  db.prepare('INSERT INTO dm_index_n.index_grp2_TnrAmtProp_Season VALUES (?,?,?,?,?)').run(product,office,amount,quarter,tag);
}
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.function('if',(condition,yes,no)=>condition?yes:no);
  db.function('quarter',date=>Math.ceil(Number(date.slice(5,7))/3));
  db.function('concat',{varargs:true},(...parts)=>parts.join(''));
  db.aggregate('collect_set',{start:'[]',step:(state,value)=>JSON.stringify([...new Set([...JSON.parse(state),...(value==null?[]:[value])])])});
  db.function('concat_ws',(separator,value)=>value==null?'':JSON.parse(value).join(separator));
  // The one Hive split(...)[2] is adapted to the third literal-dot segment of this fixture.
  // This does not claim full Hive regex/string-escape or array-index compatibility.
  db.function('fixture_product_code',value=>value==null?null:(value.split('.')[2]??null));
  db.exec(`ATTACH DATABASE ':memory:' AS DM_OTC_N; ATTACH DATABASE ':memory:' AS pdata_n;
    ATTACH DATABASE ':memory:' AS dm_index_n; ATTACH DATABASE ':memory:' AS ODATA_N_OIS;
    CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT (Agt_Id TEXT,Cutp_Pty_Full_Name TEXT,USCC TEXT,Sign_Prd_Name TEXT,busi_date TEXT,grp_id TEXT,Accrued_Date TEXT);
    CREATE TABLE pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM (Pty_Cutp_Name TEXT,Bel_Inr_Org_Name TEXT,Dev_Dept_Rwd REAL,Sett_Time TEXT,src_tbl TEXT,busi_date TEXT);
    CREATE TABLE dm_index_n.index_grp2_TnrAmtProp_Season (grp_id1 TEXT,grp_id2 TEXT,index_val REAL,busi_quat TEXT,tag_id TEXT);
    CREATE TABLE dm_index_n.grp_def (grp_id TEXT,grp_val TEXT,grp_type_code TEXT);
    CREATE TABLE ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY (prod_code TEXT,signature_name TEXT,Busi_Date TEXT);
    INSERT INTO dm_index_n.grp_def VALUES ('G_A','证券.产品.P_A','NEWS_SECU'),('G_B','证券.产品.P_B','NEWS_SECU'),('G_OFFICE','营业部.甲','BUSINESSOFFICE');`);
  const base = db.prepare('INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT VALUES (?,?,?,?,?,?,?)');
  base.run('A','客户甲','U001','产品甲',today,'01','2026-01-05');
  base.run('B','客户乙','U002','产品乙',today,'02','2026-02-05');
  const product = db.prepare('INSERT INTO ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY VALUES (?,?,?)');
  product.run('P_A','产品甲',today); product.run('P_B','产品乙',today);
  index(db,'G_A',0.1,'2025Q4'); index(db,'G_A',0.2); // Positive ordinary fixture values -> relation yes.
  index(db,'G_B',0); // Zero product aggregate -> relation no.
  reward(db,'客户甲','资产托管部',100);
  reward(db,'客户甲','发展研究中心',200);
  reward(db,'客户甲','财富管理与经纪业务总部',300);
  reward(db,'客户甲','其他介绍部门',400);
  reward(db,'客户甲','股权衍生品业务部',500);
  return db;
}
function query(db) {
  let sql = render(branch).replaceAll('${yyyy-MM-dd}',today).replaceAll('${yyyy,-1y}','2025').replaceAll('${yyyy, -1y}','2025').replaceAll('${yyyy}','2026');
  const splitCalls = [...sql.matchAll(/split\(grp_val,[^)]*\)\[2\]/g)];
  assert.equal(splitCalls.length,1,'adapt exactly the one frozen Hive product-code extraction');
  sql = sql.replace(splitCalls[0][0],'fixture_product_code(grp_val)');
  return db.prepare(sql).all().map(row=>({...row})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function withFixture(fn) { const db=fixture();try { fn(db); } finally { db.close(); } }
const find = (rows,name,dept)=>rows.find(r=>r.company_name===name && r.coop_dept===dept);

test('frozen raw SHA, complete SELECT tokens, DDL, six-column order and generated file stay fixed',()=>{
  assert.equal(createHash('sha256').update(source.raw).digest('hex'),'7f55be8dbd5c61908ae160988792137924f1e568962f9f84e1013dabcbc80d4d');
  assert.deepEqual(tokens(render(branch)),tokens(source.query));
  assert.deepEqual(tokens(read('06_目标表结构.sql')),tokens(source.ddl));
  assert.deepEqual(parse(render(branch)).fields.map(s=>s.trim()),['company_name','company_id','coop_dept','summary','cross_sale_amount','busi_date']);
  assert.equal(read('完整SQL.sql'),render(branch));
});

test('full SELECT normal example: two customers eight slots; referral overlaps the other departments',()=>withFixture(db=>{
  const rows=query(db);assert.equal(rows.length,8);
  assert.equal(find(rows,'客户甲','托管').summary,null);
  assert.equal(find(rows,'客户甲','托管').cross_sale_amount,100);
  assert.equal(find(rows,'客户甲','研究服务').summary,'有研究服务关系');
  assert.equal(find(rows,'客户甲','研究服务').cross_sale_amount,200);
  assert.equal(find(rows,'客户甲','财富代销').summary,'有财富代销');
  assert.equal(find(rows,'客户甲','财富代销').cross_sale_amount,300);
  const referral=find(rows,'客户甲','商机转介');
  assert.equal(referral.cross_sale_amount,1000);
  assert.deepEqual(new Set(referral.summary.split('；')),new Set(['资产托管部','发展研究中心','财富管理与经纪业务总部','其他介绍部门']));
  assert.equal(rows.filter(r=>r.company_name==='客户甲').reduce((n,r)=>n+r.cross_sale_amount,0),1600);
  assert.ok(rows.filter(r=>r.company_name==='客户乙').every(r=>r.cross_sale_amount===null));
  assert.equal(find(rows,'客户乙','财富代销').summary,'无财富代销');
  assert.equal(find(rows,'客户乙','研究服务').summary,'无研究服务关系');
}));

test('positive product indicator and wealth reward are independent',()=>withFixture(db=>{
  assert.equal(find(query(db),'客户乙','财富代销').summary,'无财富代销');
  index(db,'G_B',0.1);
  const positive=find(query(db),'客户乙','财富代销');assert.equal(positive.summary,'有财富代销');assert.equal(positive.cross_sale_amount,null);
  db.exec("DELETE FROM dm_index_n.index_grp2_TnrAmtProp_Season WHERE grp_id1='G_A'");
  const negative=find(query(db),'客户甲','财富代销');assert.equal(negative.summary,'无财富代销');assert.equal(negative.cross_sale_amount,300);
}));

test('mathematical boundary only: one positive and one negative product indicator cancel before >0',()=>withFixture(db=>{
  // This artificial input tests SUM-before-predicate order, not the real indicator's permitted value range.
  db.exec("DELETE FROM dm_index_n.index_grp2_TnrAmtProp_Season WHERE grp_id1='G_B'");
  index(db,'G_B',0.1,'2025Q4');index(db,'G_B',-0.1);
  assert.equal(find(query(db),'客户乙','财富代销').summary,'无财富代销');
}));

test('zero or NULL research reward still means a matched research relationship',()=>withFixture(db=>{
  db.exec("UPDATE pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM SET Dev_Dept_Rwd=0 WHERE Bel_Inr_Org_Name='发展研究中心'");
  assert.equal(find(query(db),'客户甲','研究服务').summary,'有研究服务关系');
  db.exec("UPDATE pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM SET Dev_Dept_Rwd=NULL WHERE Bel_Inr_Org_Name='发展研究中心'");
  const research=find(query(db),'客户甲','研究服务');assert.equal(research.summary,'有研究服务关系');assert.equal(research.cross_sale_amount,null);
}));

test('same USCC under two names expands every slot, not just wealth, and can carry wealth reward to another name',()=>withFixture(db=>{
  db.prepare('INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT VALUES (?,?,?,?,?,?,?)').run('A2','客户甲新名','U001','产品甲',today,'01','2026-03-01');
  const rows=query(db);assert.equal(rows.length,20); // Two U001 base names * four slots * two wealth matches + U002 four.
  for(const name of ['客户甲','客户甲新名']) assert.equal(rows.filter(r=>r.company_name===name && r.coop_dept==='托管').length,2);
  assert.ok(rows.some(r=>r.company_name==='客户甲新名' && r.coop_dept==='财富代销' && r.cross_sale_amount===300));
}));

test('NULL USCC preserves base slots but ordinary equality cannot attach wealth summary',()=>withFixture(db=>{
  db.exec("UPDATE DM_OTC_N.OTC_REV_DAILY_RPT SET USCC=NULL WHERE Cutp_Pty_Full_Name='客户乙'");
  const rows=query(db);assert.equal(rows.length,8);assert.equal(find(rows,'客户乙','财富代销').summary,null);
}));

test('more contracts/dates of the same base customer do not re-sum preaggregated wealth reward',()=>withFixture(db=>{
  db.exec("INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT SELECT Agt_Id,Cutp_Pty_Full_Name,USCC,Sign_Prd_Name,busi_date,grp_id,'2026-09-01' FROM DM_OTC_N.OTC_REV_DAILY_RPT WHERE Agt_Id='A'");
  db.exec("INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT SELECT 'A3',Cutp_Pty_Full_Name,USCC,Sign_Prd_Name,busi_date,grp_id,Accrued_Date FROM DM_OTC_N.OTC_REV_DAILY_RPT WHERE Agt_Id='A'");
  const rows=query(db);assert.equal(rows.length,8);assert.equal(find(rows,'客户甲','财富代销').cross_sale_amount,300);
}));

test('customer base filters do not admit reward-only companies or grp04/outside dates/snapshots',()=>withFixture(db=>{
  reward(db,'只有奖励客户','发展研究中心',999);
  const put=db.prepare('INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT VALUES (?,?,?,?,?,?,?)');
  for(const [name,snapshot,group,date] of [['04客户',today,'04','2026-01-01'],['旧快照客户','2026-09-21','01','2026-01-01'],['过早客户',today,'01','2024-12-31'],['未来客户',today,'01','2026-09-23']]) put.run(name,name,name,'产品甲',snapshot,group,date);
  assert.equal(query(db).length,8);
  put.run('边界','边界客户','U003','无产品',today,'01','2025-01-01');
  assert.equal(query(db).length,12);
}));

test('reward and index quarter cutoffs, source filters, tag and group constraints use original WHERE',()=>withFixture(db=>{
  const before=query(db);
  reward(db,'客户甲','资产托管部',999,'202604');reward(db,'客户甲','资产托管部',999,'202404');
  reward(db,'客户甲','资产托管部',999,'202603','OTHER');reward(db,'客户甲','资产托管部',999,'202603','ODATA_N_OIS.G_CROSS_INCOME_REWARD','2026-09-21');
  index(db,'G_B',999,'2026Q4');index(db,'G_B',999,'2024Q4');index(db,'G_B',999,'2026Q3','OTHER');index(db,'G_B',999,'2026Q3','tag999999999','MISSING_OFFICE');
  assert.deepEqual(query(db),before);
}));

test('missing product mapping or non-business-office group loses indicator relationship, not reward',()=>withFixture(db=>{
  db.exec("DELETE FROM ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY WHERE prod_code='P_A'");
  let result=find(query(db),'客户甲','财富代销');assert.equal(result.summary,'无财富代销');assert.equal(result.cross_sale_amount,300);
  db.exec("INSERT INTO ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY VALUES ('P_A','产品甲','2026-09-22'); UPDATE dm_index_n.grp_def SET grp_type_code='OTHER' WHERE grp_id='G_OFFICE'");
  result=find(query(db),'客户甲','财富代销');assert.equal(result.summary,'无财富代销');assert.equal(result.cross_sale_amount,300);
}));

test('referral excludes own and NULL department, retains negative rewards, and does not promise list ordering',()=>withFixture(db=>{
  reward(db,'客户甲',null,999);reward(db,'客户甲','其他介绍部门',-50);
  const referral=find(query(db),'客户甲','商机转介');assert.equal(referral.cross_sale_amount,950);
  assert.equal(referral.summary.split('；').length,4); // department set de-duplicates, amount SUM does not.
}));

test('switching the USCC join, product aggregate test or department exclusion fails whole-token verification',()=>{
  const actual=render(branch);
  for(const [before,after] of [['t_base.company_id = t_cfmx.company_id','t_base.company_name = t_cfmx.company_name'],['coalesce(wei.index_val, 0) > 0','coalesce(wei.index_val, 0) >= 0'],["t.Bel_Inr_Org_Name != '股权衍生品业务部'","t.Bel_Inr_Org_Name = '股权衍生品业务部'"]]) {
    assert.ok(actual.includes(before));assert.notDeepEqual(tokens(actual.replace(before,after)),tokens(source.query));
  }
});

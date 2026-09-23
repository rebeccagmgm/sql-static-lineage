import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {scan, parse} from '../01_合约主信息/sql/checks/sql-shape.mjs';
import {expand as expandIncome} from '../../销售与经营分析/118141_交叉销售收入/render.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(root,name),'utf8');
const tokens=sql=>scan(sql).map(t=>/^[A-Za-z_]/.test(t.text)?t.text.toLowerCase():t.text);
const canonical = name => expandIncome(name);
function canonicalFields(aliases) {
  const fields = parse(canonical('01_合约日与资料.sql')).fields;
  return aliases.map(alias => {
    const field = fields.find(f => scan(f).at(-1)?.text.toLowerCase() === alias.toLowerCase());
    assert.ok(field, 'canonical output field: ' + alias);
    return scan(field).map(t => t.text).join(' ');
  }).join(',\n') + ',\n';
}
const outputFields=()=>canonicalFields(['Annu_Sprd','Absl_Sprd'])+canonical('02_原始当日收入.sql');
const names={133052:'01_合约级价差生产_133052.sql',133049:'02_客户类型级价差生产_133049.sql'};
const query=id=>read('99_证据/证据_'+id+'.sql').split('-- querySql')[1];
const original=read('99_证据/证据_118141.sql').split('\n');
const sourceJoin=original.slice(303,324).join('\n');
const customerJoin=original.slice(324,349).join('\n');
const expressions=original.slice(217,219).concat(original.slice(226,248)).join('\n');
const joins=()=>read('03_合约价差有效期_118141.sql')+'\n'+read('04_客户类型价差适用期_118141.sql');
test('legacy selection file is navigation only; formulas have one canonical owner',()=>{
  const pointer=read('05_价差选择与收入_118141.sql');
  assert.deepEqual(tokens(pointer),[]);
  assert.ok(pointer.includes('01_合约日与资料.sql'));
  assert.ok(pointer.includes('02_原始当日收入.sql'));
});
test('both complete production queries preserve every SQL token and output order',()=>{
  for(const [id,name] of Object.entries(names)) {
    assert.deepEqual(tokens(read(name)),tokens(query(id)));
    assert.equal(parse(read(name)).fields.length,id==='133052'?29:22);
  }
});
test('118141 joins, selected coefficients and entire income CASE are exact excerpts',()=>{
  assert.deepEqual(tokens(read('03_合约价差有效期_118141.sql')),tokens(sourceJoin));
  assert.deepEqual(tokens(read('04_客户类型价差适用期_118141.sql')),tokens(customerJoin));
  assert.deepEqual(tokens(outputFields()),tokens(expressions));
});
test('source copies match manifest hashes; reader links resolve',()=>{
  for(const entry of JSON.parse(read('99_证据/证据索引.json')).sources)
    assert.equal(createHash('sha256').update(read('99_证据/'+entry.file)).digest('hex'),entry.fileSha256,entry.file);
  for(const [,target] of read('README.md').matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g))
    assert.ok(existsSync(join(root,target)),target);
});
test('date key, precedence and source-identity mutations are visible',()=>{
  for(const [name,before,after] of [
    ['03_合约价差有效期_118141.sql','s_sp.busi_date = det.busi_date','s_sp.busi_date = info.Strt_Pric_Date'],
    ['04_客户类型价差适用期_118141.sql','c_sp.busi_date = info.Strt_Pric_Date','c_sp.busi_date = det.busi_date'],
    ['01_合约级价差生产_133052.sql','A.CONTRACT_CODE = B.INTERNAL_TRADE_ID','A.CONTRACT_CODE = B.KEY_OTC_TRADE_ID'],
  ]) {const sql=read(name);assert.ok(sql.includes(before));assert.notDeepEqual(tokens(sql),tokens(sql.replace(before,after)));}
});

// Synthetic examples only. SQLite is not a Hive execution validator.
const day='2026-09-22';
const addDays=(s,n)=>s===null?null:new Date(Date.parse(s+'T00:00:00Z')+Number(n)*86400000).toISOString().slice(0,10);
function setup() {
  const db=new DatabaseSync(':memory:');
  for(const schema of ['odata_n_ois','odata_n_tit','pdata_n'])db.exec("ATTACH DATABASE ':memory:' AS "+schema);
  db.function('if',(c,a,b)=>c?a:b);
  db.function('concat',(a,b)=>a===null||b===null?null:String(a)+String(b));
  db.function('date_add',addDays);
  db.function('date_sub',(s,n)=>addDays(s,-n));
  db.function('datediff',(a,b)=>a===null||b===null?null:Math.round((Date.parse(a)-Date.parse(b))/86400000));
  return db;
}
function table(db,name,columns,rows) {
  const cols=columns.split(' ');
  db.exec('CREATE TABLE '+name+' ('+cols.map(c=>c+' TEXT').join(',')+')');
  const insert=db.prepare('INSERT INTO '+name+' VALUES ('+cols.map(()=>'?').join(',')+')');
  for(const row of rows)insert.run(...cols.map(c=>row[c]??null));
}
function adapt(sql,sourceTable='') {
  sql=sql.replaceAll('${src_table}',sourceTable).replaceAll('${data_day_str}',day)
    .replaceAll('${yyyy-MM-dd}',day).replaceAll('${data_src_cd}','OIS').replaceAll('${filename}','fixture')
    .replaceAll('${data_today_str}',day).replaceAll('${data_today}',day);
  return scan(sql).map(t=>t.text).join(' ').replaceAll('! =','!=').replaceAll('< >','<>')
    .replaceAll('< =','<=').replaceAll('> =','>=').replace(/\bnvl\s*\(/gi,'coalesce(');
}
function selectOnly(sql) {const s=scan(sql).find(t=>t.depth===0&&t.text.toLowerCase()==='select');return sql.slice(s.start);}
const bag=rows=>rows.map(r=>JSON.stringify(Object.values(r))).sort();

function producerFixture(db,kind) {
  const a={contract_code:'C1',business_type:'TRS',cross_or_inr:'CROSS',contract_type:'TRS_X',
    contract_type_name:'互换',underlying_type:'STOCK',spread_calculation:'ANNUALIZED',annualized_spread:'0.006',
    absolute_spread:'0',effective_date:'2026-09-15',is_deleted:'N',busi_date:day};
  const temp={...a,cross_sell_approval_process_id:'P1',client_id:'CUSTOMER',drafter:'U1',updated_datetime:'2026-09-01'};
  const rows={trade:[{internal_trade_id:'C1',key_otc_trade_id:'I1',busi_date:day}],
    trs:[{key_otc_trade_id:'I1',busi_date:day}],option:[],ks:[],
    temp:[temp,{...temp,cross_sell_approval_process_id:'P2',updated_datetime:'2026-09-20'}],
    cp:[{client_id:'CUSTOMER',is_prod_holder:'01',department:'ED',busi_date:day}],
    hk:[{client_id:'CUSTOMER',client_type:'CPI',busi_date:day}]};
  if(kind==='option'){rows.trs=[];rows.option=[{key_otc_trade_id:'I1',busi_date:day}];}
  if(kind==='kingstar'){rows.trs=[];rows.ks=[{key_trade_comfirm_id:'C1',busi_date:day}];}
  if(kind==='unidentified')rows.trs=[];
  if(kind==='null-approval-key'){a.absolute_spread=null;rows.temp.forEach(t=>t.absolute_spread=null);}
  if(kind==='deleted')a.is_deleted='Y';
  if(kind==='duplicate-trade')rows.trade.push({...rows.trade[0]});
  if(kind==='deleted-approval')rows.temp[1].is_deleted='Y';
  if(kind==='approval-date-not-a-key')rows.temp[1].effective_date='2000-01-01';
  if(kind==='customer-no-else'){rows.cp[0].is_prod_holder='04';rows.hk[0].client_type='OTHER';}
  if(kind==='customer-duplicate')rows.cp.push({...rows.cp[0]});
  const acols='contract_code business_type cross_or_inr contract_type contract_type_name underlying_type spread_calculation annualized_spread absolute_spread effective_date discription created_datetime updated_datetime created_by updated_by is_deleted busi_date';
  table(db,'odata_n_ois.o_contract_spread_rate',acols,[a]);
  table(db,'odata_n_ois.g_contract_spread_rate_temp',acols+' cross_sell_approval_process_id client_id drafter',rows.temp);
  table(db,'odata_n_tit.d_trd_otc_trade','internal_trade_id key_otc_trade_id busi_date',rows.trade);
  table(db,'odata_n_tit.d_ref_trs','key_otc_trade_id busi_date',rows.trs);
  table(db,'odata_n_tit.d_ref_otc_option_deal','key_otc_trade_id busi_date',rows.option);
  table(db,'odata_n_tit.d_ks_trade_comfirm_info','key_trade_comfirm_id busi_date',rows.ks);
  table(db,'odata_n_ois.o_otc_derivative_counterparty','client_id is_prod_holder department busi_date',rows.cp);
  table(db,'odata_n_ois.g_hk_counterparty','client_id client_type busi_date',rows.hk);
  table(db,'odata_n_ois.o_ctpty_cross_sell_coefficient',
    'client_id business_type calculation_type contract_type contract_type_name underlying_type annualized_spread absolute_spread effective_date description created_datetime created_by is_deleted contract_start_date_min contract_start_date_max busi_date',
    [{client_id:'CUSTOMER',business_type:'OPTION',calculation_type:'ANNUALIZED',contract_type:'OPTION_X',annualized_spread:'0.002',absolute_spread:'0.01',effective_date:'2026-01-01',is_deleted:'Y',contract_start_date_min:'2026-09-01',contract_start_date_max:'2026-09-30',busi_date:day}]);
}
for(const kind of ['trs','option','kingstar','unidentified','null-approval-key','deleted','duplicate-trade',
  'deleted-approval','approval-date-not-a-key','customer-no-else','customer-duplicate']) {
  test('production: '+kind,()=>{
    const db=setup();try {
      producerFixture(db,kind);const results={};
      for(const [id,name] of Object.entries(names)) {
        const source=id==='133052'?'odata_n_ois.o_contract_spread_rate':'odata_n_ois.o_ctpty_cross_sell_coefficient';
        const run=sql=>db.prepare(adapt(selectOnly(sql),source)).all();
        const result=run(read(name));assert.deepEqual(bag(result),bag(run(query(id))));results[id]=result;
      }
      const c=results[133052][0],u=results[133049][0];
      assert.equal(c.Inr_Comp_No,'C1');assert.equal(c.Annu_Sprd_Coef,'0.006');
      assert.equal(c.Agt_Id,kind==='unidentified'?'':kind==='kingstar'?'C1':'I1');
      assert.equal(c.Agt_Modifr,kind==='unidentified'?'':kind==='kingstar'?'20206-KST':kind==='option'?'20207':'20206');
      assert.equal(c.Del_Flag,kind==='deleted'?'1':'0');
      assert.equal(c.Para_Appr_Evt_Id,kind==='null-approval-key'?null:kind==='deleted-approval'?'OIS061-P1':'OIS061-P2');
      assert.equal(results[133052].length,kind==='duplicate-trade'?2:1);
      assert.equal(results[133049].length,kind==='customer-duplicate'?2:1);
      assert.equal(u.Pty_Cate_Cd,kind==='customer-no-else'?null:'110500');
      assert.equal(u.Coef_Type,'CROSS');assert.equal(u.Del_Flag,'1','deleted parameter retained in producer');
      assert.equal(u.Annu_Sprd_Coef,'0.002');assert.equal(u.Bgng_Prcg_Date_Llmt,'2026-09-01');
    } finally {db.close();}
  });
}

function consumerFixture(db,kind) {
  const sc={Inr_Comp_No:'C1',Agt_Id:'I1',Sprd_Calc_Type:'ANNUALIZED',Annu_Sprd_Coef:'0.006',Absl_Sprd_Coef:'0',Vld_Date:'2026-09-15',Coef_Type:'CROSS',Del_Flag:'0',src_tbl:'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE'};
  const cc={Pty_Id:'CUSTOMER',Src_Comp_Type_Cd:'OPTION_X',Src_Comp_Type_Desc:'期权',Calc_Type:'ANNUALIZED',Annu_Sprd_Coef:'0.002',Absl_Sprd_Coef:'0.01',Bgng_Prcg_Date_Llmt:'2026-09-01',Bgng_Prcg_Date_Ulmt:'2026-09-30',Vld_Date:'2099-01-01',Del_Flag:'0',src_tbl:'ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT'};
  let s=[sc],c=[cc];
  const info={Agt_Id:'C1',Cutp_Pty_Id:'CUSTOMER',Contr_Type_Cd:'OPTION_X',Busi_Type:'OPTION',Strt_Pric_Date:'2026-09-10',End_Pric_Date:'2026-09-20',Init_Nom_Prin:'1000000',Src_Contr_Type:'VANILLA',Init_Marg_Prop:'0',Base_Marg_Rate:'0'};
  const det={busi_date:'2026-09-16',Dyna_Nom_Prin:'3650000',Inta:'0',Trd_Cms:'0',Trd_Cms_Cost:'0',Fnd_Cost:'0',fee_rate:'0'};
  let base='ANNUALIZED';
  if(kind==='before-effective')det.busi_date='2026-09-14';
  if(kind==='effective-boundary')det.busi_date='2026-09-15';
  if(kind==='next-version'){s.push({...sc,Vld_Date:'2026-09-17',Annu_Sprd_Coef:'0.008'});det.busi_date='2026-09-17';}
  if(kind==='previous-version-end'){s.push({...sc,Vld_Date:'2026-09-17',Annu_Sprd_Coef:'0.008'});}
  if(kind==='customer-start-not-accrual'){s=[];info.Strt_Pric_Date='2026-08-31';}
  if(kind==='customer-period-overlap'){s=[];c.push({...cc,Annu_Sprd_Coef:'0.003'});}
  if(kind==='unidentified-filter')sc.Agt_Id='';
  if(kind==='internal-filter')sc.Coef_Type='INR';
  if(kind==='null-class-kept')sc.Coef_Type=null;
  if(kind==='coefficient-zero')sc.Annu_Sprd_Coef='0';
  if(kind==='coefficient-null-mixed'){sc.Annu_Sprd_Coef=null;cc.Calc_Type='ABSOLUTE';}
  if(kind==='type-empty-fallback'){sc.Sprd_Calc_Type='';cc.Calc_Type='ABSOLUTE';sc.Absl_Sprd_Coef='0.01';det.busi_date=info.Strt_Pric_Date;sc.Vld_Date=info.Strt_Pric_Date;}
  if(kind==='missing-base')base=null;
  if(kind==='missing-all'){s=[];c=[];}
  if(kind==='absolute-start'||kind==='absolute-later'){sc.Sprd_Calc_Type='ABSOLUTE';sc.Absl_Sprd_Coef='0.01';sc.Vld_Date='2026-09-01';if(kind==='absolute-start')det.busi_date=info.Strt_Pric_Date;}
  if(kind==='sentinel-bounds'){s=[];cc.Bgng_Prcg_Date_Llmt='1900-01-01';cc.Bgng_Prcg_Date_Ulmt='2999-12-31';}
  if(kind==='special-case-first') {info.Src_Contr_Type='AIRBAGX';info.Ddct_Ptrn='DEDUCTION';}
  if(kind==='outside-accrual')det.busi_date='2026-09-21';
  table(db,'pdata_n.t99_deri_comp_sprd_coef_ref','Inr_Comp_No Agt_Id Sprd_Calc_Type Annu_Sprd_Coef Absl_Sprd_Coef Vld_Date Coef_Type Del_Flag src_tbl',s);
  table(db,'pdata_n.t99_deri_cutp_comp_type_sprd_coef_ref','Pty_Id Src_Comp_Type_Cd Src_Comp_Type_Desc Calc_Type Annu_Sprd_Coef Absl_Sprd_Coef Bgng_Prcg_Date_Llmt Bgng_Prcg_Date_Ulmt Vld_Date Del_Flag src_tbl',c);
  table(db,'info','Agt_Id Cutp_Pty_Id Contr_Type_Cd Busi_Type Strt_Pric_Date End_Pric_Date Early_Term_Date Init_Nom_Prin Src_Contr_Type Marg_Agt_Id Ddct_Ptrn Init_Marg_Prop Base_Marg_Rate', [info]);
  table(db,'det','busi_date Dyna_Nom_Prin Inta Trd_Cms Trd_Cms_Cost Fnd_Cost fee_rate',[det]);
  for(const t of ['s_ba','c_ba'])table(db,t,'BASE_CALCULATION BASE_AWARD_RATE',[{BASE_CALCULATION:base,BASE_AWARD_RATE:'0'}]);
  table(db,'cc','capital_cost',[{capital_cost:'0'}]);
  db.exec('CREATE TABLE offsets(pos INTEGER, val TEXT)');const add=db.prepare("INSERT INTO offsets VALUES (?,'')");
  for(let i=0;i<=3000;i++)add.run(i);
}
function consumerQuery(fields,joinText) {
  // Only valid nonnegative spans of at most 3000 days are tested. This adapter
  // intentionally makes no claim about Hive SPACE(-1), same-day LEAD ties, or invalid casts.
  let sql=adapt('SELECT '+fields);sql=sql.slice(0,sql.lastIndexOf(','));
  sql+=' FROM info CROSS JOIN det CROSS JOIN s_ba CROSS JOIN c_ba CROSS JOIN cc '+adapt(joinText);
  let count=0;
  sql=sql.replace(/lateral\s+view\s+posexplode\s*\(\s*split\s*\(\s*space\s*\(\s*datediff\s*\(\s*end_date\s*,\s*strt_date\s*\)\s*\)\s*,\s*' '\s*\)\s*\)\s*y\s+as\s+pos\s*,\s*val/gi,()=>{
    count++;return ' CROSS JOIN offsets y ON y.pos BETWEEN 0 AND datediff(end_date,strt_date) ';});
  assert.equal(count,2);return sql;
}
const expectations={baseline:60,'before-effective':20,'effective-boundary':60,'next-version':80,'previous-version-end':60,
  'customer-start-not-accrual':0,'customer-period-overlap':null,'unidentified-filter':20,'internal-filter':20,'null-class-kept':60,
  'coefficient-zero':0,'coefficient-null-mixed':20,'type-empty-fallback':10000,'missing-base':null,'missing-all':0,
  'absolute-start':10000,'absolute-later':0,'sentinel-bounds':20,'special-case-first':0,'outside-accrual':0};
for(const [kind,income] of Object.entries(expectations))test('118141 spread consumption: '+kind,()=>{
  const db=setup();try {
    consumerFixture(db,kind);
    const actual=db.prepare(consumerQuery(outputFields(),joins())).all();
    const expected=db.prepare(consumerQuery(expressions,sourceJoin+'\n'+customerJoin)).all();
    assert.deepEqual(bag(actual),bag(expected));
    if(kind==='customer-period-overlap'){assert.deepEqual(actual.map(x=>x.Curr_Prvs_Sales_Income).sort((a,b)=>a-b),[20,30]);return;}
    assert.equal(actual.length,1);assert.equal(actual[0].Curr_Prvs_Sales_Income,income);
    if(kind==='missing-all'){assert.equal(actual[0].Annu_Sprd,'');assert.equal(actual[0].Absl_Sprd,'');}
    if(kind==='coefficient-null-mixed')assert.equal(actual[0].Annu_Sprd,'0.002');
    if(kind==='type-empty-fallback')assert.equal(actual[0].Absl_Sprd,'0.01');
  } finally {db.close();}
});


// One continuous README example: real producer SELECTs feed the real consumer JOINs and CASE.
// Only the Hive INSERT operation and the two lateral date expansions are adapted for SQLite.
// The source partition key is restored explicitly because INSERT PARTITION is outside the SELECT.
function readmeChain(contractCoefficient) {
  const db=setup();
  try {
    producerFixture(db,'option');
    db.prepare('UPDATE odata_n_ois.o_contract_spread_rate SET contract_code=?, business_type=?, contract_type=?, contract_type_name=?, annualized_spread=?')
      .run('A1','OPTION','OPTION_STOCK','个股期权',contractCoefficient);
    db.prepare('UPDATE odata_n_tit.d_trd_otc_trade SET internal_trade_id=?').run('A1');
    db.prepare('UPDATE odata_n_ois.g_contract_spread_rate_temp SET contract_code=?, business_type=?, contract_type=?, contract_type_name=?, client_id=?, annualized_spread=?')
      .run('A1','OPTION','OPTION_STOCK','个股期权','C1',contractCoefficient);
    db.prepare('UPDATE odata_n_ois.o_ctpty_cross_sell_coefficient SET client_id=?, contract_type=?, contract_type_name=?, is_deleted=?')
      .run('C1','OPTION_STOCK','个股期权','N');
    db.prepare('UPDATE odata_n_ois.o_otc_derivative_counterparty SET client_id=?').run('C1');
    db.prepare('UPDATE odata_n_ois.g_hk_counterparty SET client_id=?').run('C1');

    const produced={};
    for(const [id,name] of Object.entries(names)) {
      const source=id==='133052'?'odata_n_ois.o_contract_spread_rate':'odata_n_ois.o_ctpty_cross_sell_coefficient';
      produced[id]=db.prepare(adapt(selectOnly(read(name)),source)).all();
    }
    assert.equal(produced[133052].length,1);
    assert.equal(produced[133049].length,1);
    const contract=produced[133052][0],customer=produced[133049][0];
    assert.equal(contract.Inr_Comp_No,'A1','118141 matches the original contract number');
    assert.equal(contract.Agt_Id,'I1','the mapped TIT trade key is a different stored field');
    assert.equal(contract.Agt_Modifr,'20207','the option identity branch was used');
    assert.equal(contract.Vld_Date,'2026-09-15');
    assert.equal(contract.Annu_Sprd_Coef,contractCoefficient);
    assert.equal(customer.Pty_Id,'C1');
    assert.equal(customer.Src_Comp_Type_Cd,'OPTION_STOCK');
    assert.equal(customer.Bgng_Prcg_Date_Llmt,'2026-09-01');
    assert.equal(customer.Bgng_Prcg_Date_Ulmt,'2026-09-30');
    assert.equal(customer.Annu_Sprd_Coef,'0.002');
    assert.equal(customer.Del_Flag,'0');

    table(db,'pdata_n.t99_deri_comp_sprd_coef_ref',Object.keys(contract).concat('src_tbl').join(' '),
      [{...contract,src_tbl:'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE'}]);
    table(db,'pdata_n.t99_deri_cutp_comp_type_sprd_coef_ref',Object.keys(customer).concat('src_tbl').join(' '),
      [{...customer,src_tbl:'ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT'}]);

    table(db,'info','Agt_Id Cutp_Pty_Id Contr_Type_Cd Busi_Type Strt_Pric_Date End_Pric_Date Early_Term_Date Init_Nom_Prin Src_Contr_Type Marg_Agt_Id Ddct_Ptrn Init_Marg_Prop Base_Marg_Rate',
      [{Agt_Id:'A1',Cutp_Pty_Id:'C1',Contr_Type_Cd:'OPTION_STOCK',Busi_Type:'OPTION',
        Strt_Pric_Date:'2026-09-10',End_Pric_Date:'2026-09-30',Init_Nom_Prin:'3650000',
        Src_Contr_Type:'NORMAL',Init_Marg_Prop:'0',Base_Marg_Rate:'0'}]);
    const dates=['2026-09-14','2026-09-15','2026-09-16'];
    table(db,'det','busi_date Dyna_Nom_Prin Inta Trd_Cms Trd_Cms_Cost Fnd_Cost fee_rate',
      dates.map(busi_date=>({busi_date,Dyna_Nom_Prin:'3650000',Inta:'0',Trd_Cms:'0',
        Trd_Cms_Cost:'0',Fnd_Cost:'0',fee_rate:'0'})));
    // Explicit annualized zero base: this isolates spread, not a missing-base fallback.
    for(const t of ['s_ba','c_ba'])
      table(db,t,'BASE_CALCULATION BASE_AWARD_RATE',[{BASE_CALCULATION:'ANNUALIZED',BASE_AWARD_RATE:'0'}]);
    table(db,'cc','capital_cost',[{capital_cost:'0'}]);
    db.exec('CREATE TABLE offsets(pos INTEGER, val TEXT)');
    const offset=db.prepare("INSERT INTO offsets VALUES (?,'')");
    for(let i=0;i<=3000;i++)offset.run(i);

    const visible='det.busi_date AS Accrued_Date, s_sp.Contract_Code AS Matched_Contract, '+
      's_sp.Annualized_Spread AS Contract_Coefficient, c_sp.Annualized_Spread AS Customer_Coefficient, ';
    return db.prepare(consumerQuery(visible+outputFields(),joins())+
      ' ORDER BY det.busi_date').all();
  } finally {db.close();}
}
for(const [name,coefficient,expectedIncome,expectedSelected] of [
  ['contract starts September 15','0.006',[20,60,60],['0.002','0.006','0.006']],
  ['only contract coefficient changes to NULL',null,[20,20,20],['0.002','0.002','0.002']],
  ['only contract coefficient changes to zero','0',[20,0,0],['0.002','0','0']],
]) test('README producer-to-income chain: '+name,()=>{
  const rows=readmeChain(coefficient);
  assert.deepEqual(rows.map(r=>r.Accrued_Date),['2026-09-14','2026-09-15','2026-09-16']);
  assert.deepEqual(rows.map(r=>r.Matched_Contract),[null,'A1','A1']);
  assert.deepEqual(rows.map(r=>r.Contract_Coefficient),[null,coefficient,coefficient]);
  assert.deepEqual(rows.map(r=>r.Customer_Coefficient),['0.002','0.002','0.002']);
  assert.deepEqual(rows.map(r=>r.Annu_Sprd),expectedSelected);
  assert.deepEqual(rows.map(r=>r.Curr_Prvs_Sales_Income),expectedIncome);
});

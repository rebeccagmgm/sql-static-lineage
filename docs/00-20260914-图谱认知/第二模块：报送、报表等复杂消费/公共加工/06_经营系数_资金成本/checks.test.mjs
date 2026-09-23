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
const read=n=>readFileSync(join(root,n),'utf8');
const tokens=s=>scan(s).map(t=>/^[A-Za-z_]/.test(t.text)?t.text.toLowerCase():t.text);
const producer=read('01_资金成本参数生产_133057.sql');
const matching=read('02_资金成本适用期_118141.sql');
const incomeSql=expandIncome('02_原始当日收入.sql');
const frozen=read('99_证据/证据_118141.sql').split('\n');
test('legacy cost income file is navigation only',()=>{
  const pointer=read('03_成本如何进入收入_118141.sql');
  assert.deepEqual(tokens(pointer),[]);
  assert.ok(pointer.includes('02_原始当日收入.sql'));
});
test('all producer tokens and 22 output positions match original',()=>{
  assert.deepEqual(tokens(producer),tokens(read('99_证据/证据_133057.sql').split('-- querySql')[1]));
  assert.equal(parse(producer).fields.length,22);
});
test('JOIN and full CASE match frozen excerpts exactly',()=>{
  assert.deepEqual(tokens(matching),tokens(frozen.slice(381,398).join('\n')));
  assert.deepEqual(tokens(incomeSql),tokens(frozen.slice(226,248).join('\n')));
});
test('evidence hashes and README links resolve',()=>{
  for(const e of JSON.parse(read('99_证据/证据索引.json')).sources)
    assert.equal(createHash('sha256').update(readFileSync(join(root,'99_证据',e.file))).digest('hex'),e.fileSha256);
  for(const [,p] of read('README.md').matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g))assert.ok(existsSync(join(root,p)),p);
});
test('date-key and missing-value mutations are detectable',()=>{
  for(const [s,a,b] of [[matching,'cc.busi_date = info.Strt_Pric_Date','cc.busi_date = det.busi_date'],
    [incomeSql,'cc.capital_cost','coalesce(cc.capital_cost,0)']]){
    assert.ok(s.includes(a));assert.notDeepEqual(tokens(s),tokens(s.replaceAll(a,b)));
  }
});
function open(){const d=new DatabaseSync(':memory:');d.function('if',(c,a,b)=>c?a:b);return d;}
function table(d,n,cols,rows){
  d.exec('CREATE TABLE '+n+' ('+cols.join(',')+')');
  const q=d.prepare('INSERT INTO '+n+' VALUES ('+cols.map(()=>'?').join(',')+')');
  for(const r of rows)q.run(...cols.map(c=>r[c]??null));
}
const adapt=s=>scan(s).map(t=>t.text).join(' ').replaceAll('! =','!=').replaceAll('< =','<=').replaceAll('> =','>=').replaceAll('< >','<>');
const parameter={Src_Comp_Type_Cd:'T',Fnd_Cost:0.03,Intr_Strt_Date:'2026-09-01',Intr_End_Date:'2026-09-15',src_tbl:'ODATA_N_OIS.G_BUS_TYPE_CAPITAL_COST',Del_Flag:'0',Src_Dept_No:'OTC'};
// SQLite recursive dates model only valid inclusive intervals, not malformed Hive lateral-view input.
function selected(rows,start,contractType='T'){
  const d=open();try{
    d.exec("ATTACH DATABASE ':memory:' AS pdata_n");
    table(d,'pdata_n.T99_DERI_COMP_TYPE_FND_COST_REF',Object.keys(parameter),rows.map(r=>({...parameter,...r})));
    table(d,'info',['Contr_Type_Cd','Strt_Pric_Date'],[{Contr_Type_Cd:contractType,Strt_Pric_Date:start}]);
    const s=adapt(matching).replaceAll('$'+'{yyyy-MM-dd}','2026-09-22');
    const inner=s.match(/from\s*\(\s*(select\s+Src_Comp_Type_Cd[\s\S]*?)\)\s*x\s+lateral/i)?.[1];assert.ok(inner);
    const on=s.slice(s.lastIndexOf(' on ')+4);
    const q='WITH RECURSIVE x AS ('+inner+'), cc(CONTRACT_TYPE,CAPITAL_COST,busi_date,end_date) AS ('+
      'SELECT CONTRACT_TYPE,CAPITAL_COST,strt_date,end_date FROM x WHERE strt_date<=end_date UNION ALL '+
      "SELECT CONTRACT_TYPE,CAPITAL_COST,date(busi_date,'+1 day'),end_date FROM cc WHERE busi_date<end_date) "+
      'SELECT cc.CAPITAL_COST AS cost FROM info LEFT JOIN cc ON '+on;
    return d.prepare(q).all().map(r=>r.cost);
  }finally{d.close();}
}
for(const [n,rows,start,result]of[
  ['start-date selection, not later accrual day',[{},{Intr_Strt_Date:'2026-09-16',Intr_End_Date:'2026-09-30',Fnd_Cost:0.04}],'2026-09-10',[0.03]],
  ['inclusive start',[{}],'2026-09-01',[0.03]],
  ['inclusive end',[{}],'2026-09-15',[0.03]],
  ['unmatched date preserves null',[{}],'2026-09-16',[null]],
  ['overlap returns both values',[{},{Fnd_Cost:0.04}],'2026-09-10',[0.03,0.04]],
  ['deletion filter',[{Del_Flag:'1'}],'2026-09-10',[null]],
  ['department filter',[{Src_Dept_No:'OTC_HK'}],'2026-09-10',[null]],
  ['source filter',[{src_tbl:'other'}],'2026-09-10',[null]],
  ['sentinel includes processing day',[{Intr_Strt_Date:'1900-01-01',Intr_End_Date:'2999-12-31'}],'2026-09-22',[0.03]],
  ['sentinel excludes future day',[{Intr_Strt_Date:'1900-01-01',Intr_End_Date:'2999-12-31'}],'2026-09-23',[null]],
])test(n,()=>assert.deepEqual(selected(rows,start),result));
function income(change={}){
  const d=open();
  const info={Src_Contr_Type:'PLAIN',Ddct_Ptrn:null,Marg_Agt_Id:null,Init_Marg_Prop:0.2,Base_Marg_Rate:0.3,
    Contr_Type_Cd:'T',Busi_Type:'TRS',Strt_Pric_Date:'2026-09-01',Early_Term_Date:null,End_Pric_Date:'2026-09-30',Init_Nom_Prin:3650000,...change.info};
  const det={Dyna_Nom_Prin:3650000,fee_rate:0.106,Inta:1000,Trd_Cms:100,Trd_Cms_Cost:20,Fnd_Cost:365000,busi_date:'2026-09-20',...change.det};
  const sp={Spread_Calculation:'ANNUALIZED',Annualized_Spread:0.006,Absolute_Spread:0.01};
  const ba={BASE_CALCULATION:'ANNUALIZED',BASE_AWARD_RATE:0.002};
  try{
    table(d,'info',Object.keys(info),[info]);table(d,'det',Object.keys(det),[det]);
    table(d,'cc',['capital_cost'],[{capital_cost:0.03,...change.cc}]);
    for(const n of ['s_sp','c_sp'])table(d,n,Object.keys(sp),[{...sp,...change[n]}]);
    for(const n of ['s_ba','c_ba'])table(d,n,Object.keys(ba),[{...ba,...change[n]}]);
    return d.prepare('SELECT '+adapt(incomeSql).replace(/,\s*$/,'')+
      ' FROM info CROSS JOIN det CROSS JOIN cc CROSS JOIN s_sp CROSS JOIN c_sp CROSS JOIN s_ba CROSS JOIN c_ba').get().Curr_Prvs_Sales_Income;
  }finally{d.close();}
}
for(const [n,c,v]of[
  ['AIRBAG deduction first even if rate absent',{info:{Src_Contr_Type:'AIRBAGX',Ddct_Ptrn:'DEDUCTION'},cc:{capital_cost:null}},0],
  ['AIRBAG without margin link',{info:{Src_Contr_Type:'AIRBAGX'}},168],
  ['AIRBAG with margin link',{info:{Src_Contr_Type:'AIRBAGX',Marg_Agt_Id:'M'}},177],
  ['AIRBAG missing rate',{info:{Src_Contr_Type:'AIRBAGX'},cc:{capital_cost:null}},null],
  ['LONG_HOLD_SWAP precedence over Kingstar',{info:{Src_Contr_Type:'LONG_HOLD_SWAP',Marg_Agt_Id:'M',Contr_Type_Cd:'TRS_KINGSTAR_SWAP'}},0],
  ['Kingstar basis times rate divided by 365',{info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP'}},495],
  ['Kingstar missing rate is null',{info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP'},cc:{capital_cost:null}},null],
  ['Kingstar explicit zero rate',{info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP'},cc:{capital_cost:0}},510],
  ['zero basis times null is null',{info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP'},det:{Fnd_Cost:0},cc:{capital_cost:null}},null],
  ['ordinary branch ignores cost parameter',{cc:{capital_cost:null}},80],
  ['no ELSE unmatched branch returns null',{info:{Busi_Type:'OTHER'}},null],
])test(n,()=>{const actual=income(c);if(v===null)assert.equal(actual,null);else {assert.equal(typeof actual,'number');assert.ok(Number.isFinite(actual));assert.ok(Math.abs(actual-v)<1e-8,n+': '+actual);}});


test('K1 example connects real producer, real parameter match and canonical income CASE',()=>{
  const d=open();let produced;
  try{
    const first={
      BUSINESS_TYPE:'TRS',CONTRACT_TYPE:'TRS_KINGSTAR_SWAP',CONTRACT_TYPE_NAME:'金仕达互换',
      UNDERLYING_TYPE:'STOCK',EFFECTIVE_DATE:'2026-09-01',CAPITAL_COST:0.03,
      CREATED_DATETIME:null,UPDATED_DATETIME:null,CREATED_BY:null,UPDATED_BY:null,DISCRIPTION:null,
      IS_DELETED:'N',DEPARTMENT:'OTC',INTEREST_START_DATE:'2026-09-01 00:00:00',
      INTEREST_END_DATE:'2026-09-15 00:00:00',BUSI_DATE:'2026-09-22',
    };
    table(d,'source_cost',Object.keys(first),[first,{
      ...first,CAPITAL_COST:0.04,INTEREST_START_DATE:'2026-09-16 00:00:00',INTEREST_END_DATE:'2026-09-30 00:00:00',
    }]);
    const select=scan(producer).find(t=>t.depth===0&&t.text.toLowerCase()==='select');
    assert.ok(select);
    const query=producer.slice(select.start).replaceAll('$'+'{src_table}','source_cost')
      .replaceAll('$'+'{data_day_str}','2026-09-22');
    produced=d.prepare(adapt(query)).all();
    assert.equal(produced.length,2);
    assert.deepEqual(produced.map(r=>[r.Src_Comp_Type_Cd,r.Fnd_Cost,r.Intr_Strt_Date,r.Intr_End_Date,r.Del_Flag]),[
      ['TRS_KINGSTAR_SWAP',0.03,'2026-09-01','2026-09-15','0'],
      ['TRS_KINGSTAR_SWAP',0.04,'2026-09-16','2026-09-30','0'],
    ]);
  }finally{d.close();}
  const firstRate=selected(produced,'2026-09-10','TRS_KINGSTAR_SWAP');
  assert.deepEqual(firstRate,[0.03]);
  assert.equal(income({info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP',Strt_Pric_Date:'2026-09-10'},
    cc:{capital_cost:firstRate[0]}}),495);
  const changedRate=selected(produced,'2026-09-16','TRS_KINGSTAR_SWAP');
  assert.deepEqual(changedRate,[0.04]);
  assert.equal(income({info:{Contr_Type_Cd:'TRS_KINGSTAR_SWAP',Strt_Pric_Date:'2026-09-16'},
    cc:{capital_cost:changedRate[0]}}),490);
});

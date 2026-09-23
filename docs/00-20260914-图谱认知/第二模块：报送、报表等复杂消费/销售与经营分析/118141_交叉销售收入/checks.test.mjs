import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,symlinkSync,mkdirSync,rmdirSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {root,render,expand,assertOutputNotSymlink} from './render.mjs';
import {scan,parse} from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read=n=>readFileSync(resolve(root,n),'utf8');
const source=read('../../公共加工/04_经营系数_价差/99_证据/证据_118141.sql');
const tokens=s=>scan(s).map(t=>/^[A-Za-z_]/.test(t.text)?t.text.toLowerCase():t.text);
export function stages(sql){
  const ts=scan(sql), bodies={};let i=0;
  assert.equal(ts[i++].text.toLowerCase(),'with');
  while(true){
    const name=ts[i++].text.toLowerCase();
    assert.equal(ts[i++].text.toLowerCase(),'as');
    const open=ts[i++];assert.equal(open.text,'(');
    const close=ts.findIndex((t,j)=>j>=i&&t.text===')'&&t.depth===open.depth);
    assert.ok(close>i);assert.ok(!(name in bodies));
    bodies[name]=sql.slice(open.end,ts[close].start);i=close+1;
    if(ts[i].text!==',')break;i++;
  }
  return {bodies,final:sql.slice(ts[i].start)};
}
export function restore(sql){
  const {bodies,final}=stages(sql),used=new Set();
  function inline(body,active=[]){
    const ts=scan(body),edits=[];
    for(let i=0;i<ts.length-1;i++){
      if(!['from','join'].includes(ts[i].text.toLowerCase()))continue;
      const name=ts[i+1].text.toLowerCase();
      if(!(name in bodies))continue;
      if(active.includes(name))throw Error('Recursive CTE: '+name);
      used.add(name);
      edits.push({start:ts[i+1].start,end:ts[i+1].end,value:'('+inline(bodies[name],[...active,name])+')'});
    }
    for(const e of edits.reverse())body=body.slice(0,e.start)+e.value+body.slice(e.end);
    return body;
  }
  const original=inline(final);
  assert.deepEqual([...used].sort(),Object.keys(bodies).sort(),'every delivered CTE must enter final query');
  return original;
}
test('actual assembled main query restores all original tokens and final field order',()=>{
  const actual=restore(render());
  assert.deepEqual(tokens(actual),tokens(source));
  assert.deepEqual(parse(actual).fields.map(tokens),parse(source).fields.map(tokens));
  assert.equal(parse(actual).fields.length,92);
});
test('generated complete SQL equals current include tree; frozen source hash is pinned',()=>{
  assert.equal(read('完整SQL.sql'),render());
  assert.equal(createHash('sha256').update(source).digest('hex'),'633235e763cac82cda29bf8fab9ac08d7a798980dc1644392b7304ca541a5e6b');
});
test('main-stage wiring and CASE mutations fail whole-query comparison',()=>{
  const sql=render();
  for(const [before,after]of[
    ['FROM adjusted_day_income X','FROM contract_day_income X'],
    ['and End_Pric_Date = Accrued_Date','and End_Pric_Date != Accrued_Date'],
    ['Init_Nom_Prin * 0.001','Init_Nom_Prin * 0.002'],
  ]){
    assert.ok(sql.includes(before));
    assert.throws(()=>assert.deepEqual(tokens(restore(sql.replaceAll(before,after))),tokens(source)));
  }
});
test('include validation rejects escape, unapproved neighbor, non-SQL, cycles and empty input',()=>{
  for(const name of ['../../../outside.sql','../../公共加工/04_经营系数_价差/99_证据/证据_118141.sql','README.md'])
    assert.throws(()=>expand(name,()=> 'SELECT 1'));
  assert.throws(()=>expand('00_主脚本.sql',()=> '-- @include 00_主脚本.sql'),/Circular/);
  assert.throws(()=>expand('00_主脚本.sql',()=> ''),/empty/);
});

test('business rule modules enter one CASE once, in frozen precedence, with no copied SELECT or independent CASE',()=>{
  const expected=[
    ['02.1_特殊类型与保证金关联.sql',4],
    ['02.2_金仕达原始收入.sql',1],
    ['02.3_普通期权原始收入.sql',4],
    ['02.4_普通互换原始收入.sql',4],
  ];
  const entry=read('02_原始当日收入.sql');
  assert.deepEqual([...entry.matchAll(/^-- @include (.+)$/gm)].map(m=>m[1].trim()),expected.map(([name])=>name));
  assert.deepEqual(tokens(entry),['case','end','as','curr_prvs_sales_income',',']);
  for(const [name,count] of expected){
    const fragment=scan(read(name));
    assert.equal(fragment[0].text.toLowerCase(),'when',name);
    assert.equal(fragment.filter(t=>t.text.toLowerCase()==='when').length,count,name);
    assert.ok(!fragment.some(t=>['select','case','union'].includes(t.text.toLowerCase())),name);
    const changed=expand('00_主脚本.sql',path=>readFileSync(path,'utf8')+(path.endsWith(name)?'\nWHEN 1 = 1 THEN 999\n':''));
    assert.notDeepEqual(tokens(restore(changed)),tokens(source),'mutating each included rule must affect the main query: '+name);
  }
  assert.equal(scan(expand('02_原始当日收入.sql')).filter(t=>t.text.toLowerCase()==='when').length,13);
});

test('all local walkthrough links resolve and each business guide points to its delivered rule module',()=>{
  for(const name of readdirSync(root).filter(n=>n.endsWith('.md'))){
    const markdown=read(name);
    assert.ok(markdown.trim(),name+' must not be empty');
    for(const [,rawLink]of markdown.matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g)){
      const link=rawLink.replace(/^<|>$/g,'');
      if(/^(https?:|mailto:|#)/i.test(link))continue;
      assert.ok(existsSync(resolve(root,decodeURIComponent(link.split('#')[0]))),name+' → '+link);
    }
  }
  for(const [guide,module]of[
    ['README.md','02.3_普通期权原始收入.sql'],
    ['09_普通互换收入贯通.md','02.4_普通互换原始收入.sql'],
    ['10_AIRBAG与关联保证金收入贯通.md','02.1_特殊类型与保证金关联.sql'],
    ['11_金仕达收入与系统费用贯通.md','02.2_金仕达原始收入.sql'],
  ])assert.ok(read(guide).includes(']('+module+')'),guide+' must link its actual SQL rule');
});

// Projection fixtures execute the delivered first SELECT, adjustment layer and allocation layer.
// The five parameter JOINs are not reimplemented here: fixture rows represent their matched inputs.
// Full-query token restoration above verifies that their actual JOINs remain in the delivered query.
const low=t=>t.text.toLowerCase();
function adapted(sql){
  return scan(sql).map(t=>t.text).join(' ')
    .replaceAll('! =','!=').replaceAll('< >','<>').replaceAll('< =','<=').replaceAll('> =','>=')
    .replaceAll('$'+'{yyyy-MM-dd}','2026-09-21').replaceAll('$'+'{yyyy}','2026')
    .replace(/default\s*\.\s*gfgreatest/gi,'gfgreatest');
}
function withDb(action){
  const db=new DatabaseSync(':memory:');
  db.function('if',(c,a,b)=>c?a:b);
  db.function('datediff',(a,b)=>a===null||b===null?null:(Date.parse(a)-Date.parse(b))/86400000);
  db.function('gfgreatest',(a,b)=>a===null||b===null?null:Math.max(Number(a),Number(b)));
  db.function('concat',(a,b)=>a===null||b===null?null:String(a)+String(b));
  db.function('quarter',s=>s===null?null:Math.ceil(Number(s.slice(5,7))/3));
  db.function('unix_timestamp',()=>1790000000);
  db.function('from_unixtime',{varargs:true},()=> '2026-09-21 12:00:00');
  db.function('nvl',(a,b)=>a??b);
  try{return action(db);}finally{db.close();}
}
function createRows(db,name,cols,rows){
  db.exec('CREATE TABLE '+name+' ('+cols.map(c=>'"'+c+'"').join(',')+')');
  const insert=db.prepare('INSERT INTO '+name+' VALUES ('+cols.map(()=>'?').join(',')+')');
  for(const row of rows)insert.run(...cols.map(c=>row[c]??null));
}
function optionFixture(change={}){
  return withDb(db=>{
    const {bodies,final}=stages(render()),parts=parse(bodies.contract_day_income);
    const firstSelect='SELECT '+parts.fields.map(adapted).join(',\n');
    const references=new Map(),ts=scan(firstSelect);
    for(let i=0;i<ts.length-2;i++){
      if(ts[i+1].text!=='.')continue;
      const alias=low(ts[i]),column=low(ts[i+2]);
      if(!references.has(alias))references.set(alias,new Set());
      references.get(alias).add(column);
    }
    for(const field of ['ddct_ptrn','init_marg_prop','base_marg_rate'])references.get('info').add(field);
    references.get('s_ba').add('additional_reward');
    const inputs={};
    for(const [fixtureId,config] of (change.contracts??[change]).entries()){
    const info={
      agt_id:'OPT_DEMO',busi_type:'OPTION',contr_type_cd:'OPTION_STOCK',src_contr_type:'NORMAL',grp_id:'01',
      strt_pric_date:'2026-09-18',end_pric_date:'2026-09-20',early_term_date:null,init_nom_prin:3650000,
      ...config.info,
    };
    const dates=['2026-09-18','2026-09-19','2026-09-20','2026-09-21'];
    const rows={
      info:[info],
      det:config.det??dates.map((day,i)=>({busi_date:day,dyna_nom_prin:i<3?3650000:0})),
      m:[{intro_oper_user_id:'INTRO',inr_org_id_1:'1234',allo_prop_1:0.7,allo_prop_2:0.3,allo_prop_3:0,...config.m}],
      s_sp:[{spread_calculation:'ANNUALIZED',annualized_spread:0.006,...config.s_sp}],
      c_sp:[config.c_sp??{}],
      s_ba:[{base_calculation:'ANNUALIZED',base_award_rate:0.004,...config.s_ba}],
      c_ba:[config.c_ba??{}],
      cc:[config.cc??{}],
    };
    if(config.duplicateDay)rows.det.push({...rows.det[0]});
    for(const alias of references.keys()){
      inputs[alias]??=[];
      inputs[alias].push(...(rows[alias]??[{}]).map(row=>({...row,fixture_contract:fixtureId})));
    }
    }
    for(const [alias,cols]of references)createRows(db,'input_'+alias,[...cols,'fixture_contract'],inputs[alias]);
    db.exec("ATTACH DATABASE ':memory:' AS pdata_n");
    createRows(db,'pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM',
      ['Contr_Id','Dev_Dept_Rwd','Sett_End_Date','busi_date','src_tbl','Sett_Time'],
      change.history===undefined?[]:[{
        Contr_Id:'OPT_DEMO',Dev_Dept_Rwd:change.history,Sett_End_Date:'2026-06-30',
        busi_date:'2026-09-21',src_tbl:'ODATA_N_OIS.G_CROSS_INCOME_REWARD',Sett_Time:'202602',
      }]);
    // Fixture identity pairs already-matched inputs; it is NOT a new production JOIN key.
    const aliases=[...references.keys()];
    const inputFrom=aliases.map((a,i)=>'input_'+a+' '+a+(i?' ON '+a+'.fixture_contract = '+aliases[0]+'.fixture_contract':'')).join(' JOIN ');
    const sql='WITH contract_day_income AS ('+firstSelect+' FROM '+inputFrom+'), '+
      'adjusted_day_income AS ('+bodies.adjusted_day_income+'), '+
      'allocated_day_income AS ('+bodies.allocated_day_income+') '+
      'SELECT * FROM allocated_day_income ORDER BY Accrued_Date';
    const result=db.prepare(adapted(sql.replace('ORDER BY Accrued_Date','ORDER BY Agt_Id, Accrued_Date'))).all().map(row=>({...row}));
    const raw=db.prepare(adapted(firstSelect+' FROM '+inputFrom+' ORDER BY info.Agt_Id, det.busi_date')).all();
    // SQLite String affinity differs from Hive: only the final cast type is adapted to TEXT.
    const prefix=sql.slice(0,sql.lastIndexOf('SELECT * FROM allocated_day_income'));
    const reportSql=adapted(prefix+final).replace(/AS\s+String\b/gi,'AS TEXT');
    const report=db.prepare(reportSql+' ORDER BY Agt_Id, Accrued_Date').all();
    return {result,raw,report};
  });
}
function values(rows,key){return rows.map(r=>r[key]);}
function closeValues(actual,expected){
  assert.equal(actual.length,expected.length);
  actual.forEach((v,i)=>{
    if(expected[i]===null){assert.equal(v,null);return;}
    assert.equal(typeof v,'number','numeric expectations must not accept NULL or strings');
    assert.ok(Number.isFinite(v),'numeric expectations must be finite');
    assert.ok(Math.abs(v-expected[i])<1e-8,String(actual));
  });
}
function closeReportValues(actual,expected){
  for(const value of actual){
    assert.equal(typeof value,'string','CAST output must be a string, not NULL');
    assert.ok(value.trim().length>0,'empty output must not become numeric zero');
    assert.ok(Number.isFinite(Number(value)),'report amount must be finite');
  }
  closeValues(actual.map(Number),expected);
}
test('numeric comparison rejects NULL-as-zero, strings and non-finite values',()=>{
  assert.throws(()=>closeValues([null],[0]));
  assert.throws(()=>closeValues(['0'],[0]));
  assert.throws(()=>closeValues([Infinity],[0]));
  assert.throws(()=>closeValues([NaN],[0]));
  closeValues([0],[0]);
  assert.throws(()=>closeReportValues([null],[0]));
  assert.throws(()=>closeReportValues([''],[0]));
  assert.throws(()=>closeReportValues([' '],[0]));
  assert.throws(()=>closeReportValues(['Infinity'],[0]));
  closeReportValues(['0.0'],[0]);
});
test('output protection rejects existing and dangling symlinks',()=>{
  const temp=mkdtempSync(resolve(tmpdir(),'118141-output-'));
  const link=resolve(temp,'linked.sql'),target=resolve(temp,'target.sql');
  try{
    assert.doesNotThrow(()=>assertOutputNotSymlink(link));
    // Windows permits junction creation without the privilege needed for file symlinks.
    // Both are symbolic links to lstat; reject either before writing the fixed output path.
    mkdirSync(target);
    symlinkSync(target,link,'junction');
    assert.throws(()=>assertOutputNotSymlink(link),/symlink output/);
    rmdirSync(target);
    assert.throws(()=>assertOutputNotSymlink(link),/symlink output/);
  }finally{
    for(const path of [link,target]){try{rmdirSync(path);}catch(error){if(error.code!=='ENOENT')throw error;}}
    rmdirSync(temp);
  }
});
test('ordinary option walks all actual projections: raw, floor, allocation and cumulative',()=>{
  const {result,raw}=optionFixture();
  closeValues(values(raw,'Curr_Prvs_Sales_Income'),[100,100,100,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,100,3450,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[100,200,3650,3650]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_1'),[70,70,2415,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_2'),[30,30,1035,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_3'),[0,0,0,0]);
  closeValues(values(result,'Accum_prvs_sales_income_1'),[70,140,2555,2555]);
  closeValues(values(result,'Accum_prvs_sales_income_2'),[30,60,1095,1095]);
  closeValues(values(result,'Init_Nom_Prin_Main'),[1460000,1460000,1460000,1460000]);
  closeValues(values(result,'Init_Nom_Prin_Intro'),[2190000,2190000,2190000,2190000]);
  assert.deepEqual(values(result,'Actl_Days'),[1,2,3,3]);
});
test('only changing early termination moves effective end and floor to September 19',()=>{
  const {result,raw}=optionFixture({info:{early_term_date:'2026-09-19'}});
  closeValues(values(raw,'Curr_Prvs_Sales_Income'),[100,100,0,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,3550,0,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[100,3650,3650,3650]);
  assert.deepEqual(values(result,'End_Pric_Date'),Array(4).fill('2026-09-19'));
  assert.deepEqual(values(result,'Is_Preterm_Flag'),Array(4).fill('1'));
});
test('empty base type does not fall back like NULL; normal income has no ELSE',()=>{
  const {raw}=optionFixture({s_ba:{base_calculation:''},c_ba:{base_calculation:'ANNUALIZED',base_award_rate:0.004}});
  assert.deepEqual(values(raw,'Curr_Prvs_Sales_Income'),[null,null,null,null]);
});
test('NULL base type falls back to type-level parameter',()=>{
  const {raw}=optionFixture({s_ba:{base_calculation:null},c_ba:{base_calculation:'ANNUALIZED',base_award_rate:0.004}});
  closeValues(values(raw,'Curr_Prvs_Sales_Income'),[100,100,100,0]);
});
test('historical reward changes adjustment amount but does not enter trigger comparison',()=>{
  const {result}=optionFixture({history:100});
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,100,3350,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[100,200,3550,3550]);
});
test('large history permits negative adjustment; greatest applies after cumulative SUM',()=>{
  const {result}=optionFixture({history:4000});
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,100,-550,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[100,200,0,0]);
});
test('duplicate date peers are not deduplicated and affect default window frame',()=>{
  const {result}=optionFixture({duplicateDay:true});
  assert.equal(result.length,5);
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,100,100,3350,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[200,200,300,3650,3650]);
});
test('missing allocation produces NULL daily share while cumulative coalesce supplies zero',()=>{
  const {result}=optionFixture({m:{allo_prop_1:null}});
  assert.deepEqual(values(result,'Curr_Prvs_Sales_Income_1'),Array(4).fill(null));
  closeValues(values(result,'Accum_prvs_sales_income_1'),[0,0,0,0]);
});

test('independent reward producer preserves all original tokens and 45 columns',()=>{
  const producer=read('08_历史奖励来源_203358.sql');
  const evidence=read('证据_203358.sql').split('-- querySql')[1];
  assert.ok(evidence);
  assert.deepEqual(tokens(producer),tokens(evidence));
  assert.equal(parse(producer).fields.length,45);
  assert.ok(!render().includes('INSERT OVERWRITE TABLE T98_OTC_DERI_UNDRL_INCOME_RWD_SUM'));
});

// Business walkthroughs use the actual 01/02 SELECT, 04 adjustment, 06 allocation,
// and 07 output. Inputs below represent matched rows, not a reimplementation of five JOINs.
const days=['2026-09-18','2026-09-19','2026-09-20','2026-09-21'];
const trs=()=>({
  info:{agt_id:'TRS_DEMO',busi_type:'TRS',contr_type_cd:'TRS_N_STOCK',src_contr_type:'NORMAL',grp_id:'02'},
  det:days.map((busi_date,i)=>({busi_date,dyna_nom_prin:[3650000,2920000,1825000,0][i]})),
});
const airbag=()=>({
  info:{agt_id:'AIR_DEMO',src_contr_type:'AIRBAGX',contr_type_cd:'OPTION_RISKY_AIRBAGX_CIR_STOCK',
    ddct_ptrn:'NON_DEDUCTION',marg_agt_id:null,init_marg_prop:0.2,base_marg_rate:0.1},
  det:days.map((busi_date,i)=>({busi_date,dyna_nom_prin:i<3?3650000:0,fee_rate:0.106})),
  cc:{capital_cost:0.03},
});
const kingstar=(id,factor)=>({
  info:{agt_id:id,busi_type:'TRS',src_contr_type:'KS',contr_type_cd:'TRS_KINGSTAR_SWAP',grp_id:'03'},
  det:days.slice(0,2).map(busi_date=>({busi_date,dyna_nom_prin:3650000*factor,
    inta:1000*factor,trd_cms:2130*factor,trd_cms_cost:50*factor,fnd_cost:365000*factor})),
  cc:{capital_cost:0.02},
});

test('ordinary TRS walkthrough: changing daily positions reaches the actual 92-column report',()=>{
  const {raw,result,report}=optionFixture(trs());
  closeValues(values(raw,'Curr_Prvs_Sales_Income'),[100,80,50,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[100,80,50,0]);
  closeValues(values(result,'Accum_prvs_sales_income'),[100,180,230,230]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_1'),[70,56,35,0]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_2'),[30,24,15,0]);
  closeValues(values(result,'Absl_Nom_Prin'),[0,0,0,0]);
  closeValues(values(result,'Accum_Absl_Nom_Prin'),[3650000,6570000,8395000,8395000]);
  assert.equal(Object.keys(report[0]).length,92);
  assert.deepEqual(values(report,'busi_date'),Array(4).fill('2026-09-21'));
  assert.deepEqual(values(report,'Agt_Id'),Array(4).fill('TRS_DEMO'));
  closeReportValues(values(report,'Curr_Prvs_Sales_Income'),[100,80,50,0]);
  assert.equal(report[2].Curr_Prvs_Sales_Income_1,'35.0');
});

test('TRS four annual/absolute combinations retain initial-principal versus daily-principal distinction',()=>{
  for(const [spread,base,expected]of[
    ['ANNUALIZED','ANNUALIZED',[100,80,50,0]],
    ['ANNUALIZED','ABSOLUTE',[3710,48,30,0]],
    ['ABSOLUTE','ANNUALIZED',[7340,32,20,0]],
    ['ABSOLUTE','ABSOLUTE',[10950,0,0,0]],
  ]){
    const cfg=trs();cfg.s_sp={spread_calculation:spread,absolute_spread:0.002};
    cfg.s_ba={base_calculation:base,base_award_rate:base==='ABSOLUTE'?0.001:0.004};
    closeValues(values(optionFixture(cfg).raw,'Curr_Prvs_Sales_Income'),expected);
  }
});

test('TRS single-variable changes: early end, missing principal, zero and NULL coefficient',()=>{
  const early=trs();early.info.early_term_date='2026-09-19';
  closeValues(values(optionFixture(early).result,'Curr_Prvs_Sales_Income'),[100,80,0,0]);
  const missing=trs();missing.det[1].dyna_nom_prin=null;
  const missingResult=optionFixture(missing);
  assert.equal(missingResult.raw[1].Dyna_Nom_Prin,0);
  assert.equal(missingResult.raw[1].Curr_Prvs_Sales_Income,null);
  for(const [value,expected]of [[0,[60,48,30,0]],[null,[100,80,50,0]]]){
    const cfg=trs();cfg.s_ba={base_award_rate:value};cfg.c_ba={base_award_rate:0.004};
    closeValues(values(optionFixture(cfg).raw,'Curr_Prvs_Sales_Income'),expected);
  }
});

test('AIRBAG walkthrough: unlinked then linked margin, allocation and final display',()=>{
  const unlinked=optionFixture(airbag());
  closeValues(values(unlinked.raw,'Curr_Prvs_Sales_Income'),[168,168,168,0]);
  closeValues(values(unlinked.result,'Curr_Prvs_Sales_Income'),[168,168,168,0]);
  closeValues(values(unlinked.result,'Accum_prvs_sales_income'),[168,336,504,504]);
  closeValues(values(unlinked.result,'Curr_Prvs_Sales_Income_1'),[117.6,117.6,117.6,0]);
  closeValues(values(unlinked.result,'Curr_Prvs_Sales_Income_2'),[50.4,50.4,50.4,0]);
  closeReportValues(values(unlinked.report,'Fin_Rati'),[0.8,0.8,0.8,0.8]);
  const linked=airbag();linked.info.marg_agt_id='MARGIN_TRS';
  closeValues(values(optionFixture(linked).raw,'Curr_Prvs_Sales_Income'),[159,159,159,0]);
});

test('special CASE priority: deduction, missing deduction, linked LONG_HOLD and non-X AIRBAG',()=>{
  const deduction=airbag();deduction.info.ddct_ptrn='DEDUCTION';deduction.cc.capital_cost=null;
  closeValues(values(optionFixture(deduction).raw,'Curr_Prvs_Sales_Income'),[0,0,0,0]);
  const missingDeduction=airbag();missingDeduction.info.ddct_ptrn=null;
  closeValues(values(optionFixture(missingDeduction).raw,'Curr_Prvs_Sales_Income'),[168,168,168,0]);
  const longHold=trs();longHold.info.src_contr_type='LONG_HOLD_SWAP';longHold.info.marg_agt_id='OPTION_LINK';
  closeValues(values(optionFixture(longHold).raw,'Curr_Prvs_Sales_Income'),[0,0,0,0]);
  longHold.info.marg_agt_id=null;
  closeValues(values(optionFixture(longHold).raw,'Curr_Prvs_Sales_Income'),[100,80,50,0]);
  const plain=airbag();plain.info.src_contr_type='AIRBAG';
  closeValues(values(optionFixture(plain).raw,'Curr_Prvs_Sales_Income'),[100,100,100,0]);
});

test('AIRBAG does not add an end-date guard; missing cost and zero margin denominator stay unprotected',()=>{
  const early=airbag();early.info.early_term_date='2026-09-19';
  closeValues(values(optionFixture(early).raw,'Curr_Prvs_Sales_Income'),[168,168,168,0]);
  const missing=airbag();missing.cc.capital_cost=null;
  const out=optionFixture(missing);
  assert.deepEqual(values(out.raw,'Curr_Prvs_Sales_Income'),[null,null,null,null]);
  closeValues(values(out.result,'Accum_prvs_sales_income'),[0,0,0,0]);
  const denominator=airbag();denominator.info.marg_agt_id='LINK';denominator.info.base_marg_rate=1;
  // SQLite division by zero is NULL; this does not certify Hive's runtime behavior.
  assert.deepEqual(values(optionFixture(denominator).raw,'Curr_Prvs_Sales_Income'),[null,null,null,null]);
});

test('Kingstar two-contract walkthrough: same-day pool allocation then per-contract cumulative and report',()=>{
  const {raw,result,report}=optionFixture({contracts:[kingstar('KS_A',1),kingstar('KS_B',2)]});
  const a=1500-1500000/365*0.5/3,b=3000-1500000/365*0.5*2/3;
  closeValues(values(raw,'Curr_Prvs_Sales_Income'),[1500,1500,3000,3000]);
  closeValues(values(result,'Curr_Prvs_Sales_Income'),[a,a,b,b]);
  closeValues(values(result,'Accum_prvs_sales_income'),[a,2*a,b,2*b]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_1'),[a*.7,a*.7,b*.7,b*.7]);
  closeValues(values(result,'Curr_Prvs_Sales_Income_2'),[a*.3,a*.3,b*.3,b*.3]);
  closeReportValues(values(report,'Curr_Prvs_Sales_Income'),[a,a,b,b]);
  closeReportValues(values(report,'Accum_prvs_sales_income'),[a,2*a,b,2*b]);
  assert.ok(report.every(row=>row.Contr_Type_Cd==='TRS_KINGSTAR_SWAP'&&row.busi_date==='2026-09-21'));
  assert.equal(result[0].fee_rate,null);
});

test('Kingstar peers affect the system fee; negative daily income is not clipped before SUM',()=>{
  const {result}=optionFixture({contracts:[kingstar('KS_A',1)]});
  closeValues(values(result,'Curr_Prvs_Sales_Income'),Array(2).fill(1500-1500000/365*0.5));
  closeValues(values(result,'Accum_prvs_sales_income'),[0,0]);
});

test('Kingstar zero and NULL daily pool denominator remain unprotected in delivered SQL',()=>{
  const zero=kingstar('KS_ZERO',0);
  const zeroResult=optionFixture({contracts:[zero]});
  closeValues(values(zeroResult.raw,'Curr_Prvs_Sales_Income'),[0,0]);
  assert.deepEqual(values(zeroResult.result,'Curr_Prvs_Sales_Income'),[null,null]);
  const missing=kingstar('KS_MISSING',1);missing.cc.capital_cost=null;
  const missingResult=optionFixture({contracts:[missing]});
  assert.deepEqual(values(missingResult.raw,'Curr_Prvs_Sales_Income'),[null,null]);
  assert.deepEqual(values(missingResult.result,'Curr_Prvs_Sales_Income'),[null,null]);
  closeValues(values(missingResult.result,'Accum_prvs_sales_income'),[0,0]);
});

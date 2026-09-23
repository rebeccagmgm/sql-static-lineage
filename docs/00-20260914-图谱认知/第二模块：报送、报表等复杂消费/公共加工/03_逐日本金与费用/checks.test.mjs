import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {root, expand, render} from './render.mjs';
import {scan, parse} from '../01_合约主信息/sql/checks/sql-shape.mjs';

export const original = readFileSync(join(root,'../99_证据/107491-query.sql'),'utf8');
const tokenValues = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);

// Only reverses named FROM/JOIN inputs in this task; no formula normalization.
// Every expanded token, including all lateral expansions, is compared below.
export function flatten(sql) {
  const ts = scan(sql), bodies = new Map();
  for (let i=0;i<ts.length-2;i++) {
    if (ts[i].depth===0 && ts[i+1].text.toLowerCase()==='as' && ts[i+2].text==='(') {
      const close = ts.slice(i+3).find(t => t.text===')' && t.depth===0);
      const name = ts[i].text.toLowerCase();
      assert.ok(!bodies.has(name),'unique CTE');
      bodies.set(name,sql.slice(ts[i+2].end,close.start));
    }
  }
  assert.equal(bodies.size,17,'all documented stages exist');
  const visited = new Set();
  function inline(text,active=[]) {
    const tokens = scan(text), edits = [];
    for (let i=0;i<tokens.length-1;i++) {
      if (!['from','join'].includes(tokens[i].text.toLowerCase())) continue;
      const next = tokens[i+1], name = next.text.toLowerCase();
      if (!bodies.has(name)) continue;
      assert.ok(!active.includes(name),'acyclic CTEs');
      visited.add(name);
      edits.push({start:next.start,end:next.end,text:'('+inline(bodies.get(name),[...active,name])+')'});
    }
    for (const e of edits.reverse()) text=text.slice(0,e.start)+e.text+text.slice(e.end);
    return text;
  }
  const withToken=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='with');
  const insert=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='insert');
  const result=sql.slice(0,withToken.start)+inline(sql.slice(insert.start));
  assert.equal(visited.size,bodies.size,'no disconnected or unused reading steps');
  return result;
}

test('107491: frozen source, all 23 expressions, every query/JOIN/window/filter unchanged',()=>{
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '8f655b98522a2a9bf6e4c8aa4d945e163242145551096ab992c516dabc825ca6');
  const sql=render();
  assert.equal(parse(sql).fields.length,23,'21 value columns + 2 partition columns');
  assert.deepEqual(tokenValues(flatten(sql)),tokenValues(original));
  assert.doesNotMatch(sql,/^\s*-- @include /m);
});
test('107491: reversal exposes accidental business changes',()=>{
  const sql=render();
  for (const [before,after] of [
    ["grp_id = '01'","grp_id = '02'"],
    ['then - notional_delta','then notional_delta'],
    ['on evt.key_option_deal_id = info.Inr_Seri_No','on evt.key_option_deal_id = info.Agt_Id'],
    ["date_sub('${data_day_str}',150)","date_sub('${data_day_str}',149)"],
  ]) {
    assert.ok(sql.includes(before));
    assert.notDeepEqual(tokenValues(flatten(sql.replace(before,after))),tokenValues(original),before);
  }
});
test('107491: includes reject invalid paths, empty files and cycles',()=>{
  assert.throws(()=>expand('../x.sql'),/flat SQL/);
  assert.throws(()=>expand('x.sql',()=>''),/empty SQL/);
  assert.throws(()=>expand('x.sql',()=> '-- @include x.sql'),/Circular/);
  assert.equal(expand('x.sql',()=> "select '${data_day_str}'"),"select '${data_day_str}'");
});

// Synthetic, in-memory SQL checks only. The adapter expands valid nonnegative
// Hive day offsets with a numbers table; it is NOT an emulator of negative
// SPACE lengths, implicit Hive string casts or undocumented UDF NULL behavior.
const day='2026-09-21';
const addDays=(s,n)=>s===null?null:new Date(Date.parse(s+'T00:00:00Z')+Number(n)*86400000).toISOString().slice(0,10);
function queryOnly(sql) {
  const t=scan(sql), w=t.find(x=>x.depth===0&&x.text.toLowerCase()==='with');
  const ins=t.find(x=>x.depth===0&&x.text.toLowerCase()==='insert');
  const sel=t.find(x=>x.depth===0&&x.text.toLowerCase()==='select');
  return (w?sql.slice(w.start,ins.start):'')+sql.slice(sel.start);
}
function sqliteSql(sql) {
  let text=scan(queryOnly(sql)).map(t=>t.text).join(' ').replaceAll('< =','<=').replaceAll('> =','>=');
  let count=0;
  text=text.replace(/lateral\s+view\s+posexplode\s*\(\s*split\s*\(\s*space\s*\(([\s\S]*?)\)\s*,\s*' '\s*\)\s*\)\s+t\s+as\s+pos\s*,\s*val/gi,
    (_,span)=>{count++;return ' CROSS JOIN day_offsets ON day_offsets.pos BETWEEN 0 AND ('+span+') ';});
  assert.equal(count,5,'all five lateral date expansions are adapted');
  return text.replace(/default\s*\.\s*(gfgreatest|datekey2date)/gi,'$1')
    .replaceAll('$'+'{data_day_str}',day).replaceAll('$'+'{data_today}',day).replaceAll('$'+'{filename}','fixture');
}
const tables={
  info:['T98_OTC_DERI_COMP_SALE_INFO',['busi_date','Agt_Id','Busi_Type','Cutp_Pty_Id','Undrl_Ins_Id','Undrl_Wd_Cd',
    'Undrl_Name','Strt_Pric_Date','Early_Term_Date','End_Pric_Date','Init_Nom_Prin','Cny_Ex_Rate','Inr_Seri_No','Otc_Seri_No','grp_id']],
  evt:['odata_n_tit.d_trd_option_event',['busi_date','key_option_deal_id','event_status','event_type','event_date',
    'notional_before','notional_after','notional_delta']],
  leg:['odata_n_tit.d_ref_trs_leg',['busi_date','leg_type','key_otc_trade_id','key_leg_id']],
  pos:['odata_n_tit.d_pos_trs_leg_his_pos',['busi_date','key_leg_id','src_busi_date','Init_Price','Init_Quantity','Quantity']],
  ks:['odata_n_tit.d_ks_trade_comfirm_info',['busi_date','key_trade_comfirm_id','business_date','accrued_interest',
    'occupy_cost','dynamic_notional','profit','fee_cost']],
  fast:['odata_n_tit.d_pos_fast_trs_leg_his_pos',['busi_date','key_instrument_id','position_type','src_busi_date','dynamic_notional']],
  risk:['odata_n_tit.d_ks_trs_for_risk',['busi_date','GEN_DATE','CONTRACT_ID','GUARANTEE_RATIO']],
  fee:['odata_n_tit.d_trd_daily_accrual_fee',['busi_date','KEY_INSTRUMENT_ID','CALC_DATE','fee_type','fee_rate']],
};
function fixture(kind) {
  const group=kind.startsWith('trs')?'02':kind.startsWith('ks')?'03':kind.startsWith('fast')?'04':'01';
  const rows={
    info:[[day,'A1',group==='01'?'OPTION':'TRS','C1','U1','W1','name','2026-09-18',null,'2026-09-20',1000,1,'I1','O1',group]],
    evt:[
      [day,'I1','EFFECTIVE','PARTIAL_TERMINATION','2026-09-19',1000,800,200],
      [day,'I1','EFFECTIVE','EARLY_LOCK_PL','2026-09-20',800,700,100],
      [day,'I1','CANCELLED','PARTIAL_TERMINATION','2026-09-19',1000,1,999],
    ],
    leg:[[day,'STRUCTURE_LEG_TYPE','I1','L1']],
    pos:[
      [day,'L1','2026-09-18',10,100,70],
      [day,'L1','2026-09-19',10,100,60],
      [day,'L1','2026-09-21',10,100,30],
    ],
    ks:[
      [day,'A1','2026-09-18',10,2,800,8,1],
      [day,'A1','2026-09-20',6,4,600,3,1],
    ],
    fast:[
      [day,'O1','EOD_POSITION','2026-09-18',900],
      [day,'O1','EOD_POSITION','2026-09-20',700],
      [day,'O1','EOD_POSITION','2026-09-21',500],
      [day,'O1','OTHER','2026-09-19',999],
    ],
    risk:[[day,'20260918','A1',0.2],[day,'20260920','A1',0.3]],
    fee:[[day,'O1','2026-09-18','ACCRUAL_PREMIUM_FEE',0.1],[day,'O1','2026-09-20','ACCRUAL_PREMIUM_FEE',0.2]],
  };
  if(kind==='option-no-event')rows.evt=[];
  if(kind.endsWith('no-rate'))rows.info[0][11]=null;
  if(kind==='option-null-initial')rows.info[0][10]=null;
  if(kind==='trs-no-record')rows.pos=[];
  if(kind==='ks-no-record')rows.ks=[];
  if(kind==='lookback-window')rows.info[0][7]='2026-01-01';
  if(kind==='ended-before-window'){rows.info[0][7]='2026-01-01';rows.info[0][9]='2026-03-01';}
  if(kind==='invalid-period')rows.info[0][7]='2026-09-22';
  if(kind==='end-at-cutoff'){rows.info[0][7]='2021-01-01';rows.info[0][9]='2021-09-30';}
  if(kind==='same-day-events')rows.evt.push([day,'I1','EFFECTIVE','PARTIAL_TERMINATION','2026-09-19',800,750,50]);
  if(kind==='trs-duplicate-leg')rows.leg.push([...rows.leg[0]]);
  if(kind==='fee-window-anchor')rows.fee=[[day,'O1','2026-01-01','ACCRUAL_PREMIUM_FEE',0.15]];
  if(kind==='ks-window-anchor')rows.ks=[[day,'A1','2026-01-01',10,2,800,8,1]];
  return rows;
}
function setup(db,rows) {
  db.exec("ATTACH DATABASE ':memory:' AS odata_n_tit; CREATE TABLE day_offsets(pos, val)");
  const offset=db.prepare("INSERT INTO day_offsets VALUES (?, '')");
  for(let n=0;n<=400;n++)offset.run(n);
  db.function('if',(c,a,b)=>c?a:b);
  db.function('date_add',addDays);
  db.function('date_sub',(s,n)=>addDays(s,-Number(n)));
  db.function('datediff',(a,b)=>a===null||b===null?null:Math.round((Date.parse(a)-Date.parse(b))/86400000));
  db.function('date_format',(s,format)=>{assert.equal(format,'yyyy-MM-dd');return s;});
  db.function('substring',(s,start,n)=>s===null?null:String(s).slice(start-1,start-1+n));
  db.function('gfgreatest',(a,b)=>a===null||b===null?null:a>b?a:b);
  db.function('datekey2date',s=>s===null?null:String(s).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'));
  for(const[key,[table,columns]]of Object.entries(tables)) {
    db.exec('CREATE TABLE '+table+' ('+columns.join(',')+')');
    const insert=db.prepare('INSERT INTO '+table+' VALUES ('+columns.map(()=>'?').join(',')+')');
    for(const row of rows[key])insert.run(...row);
  }
}
const expectedAmounts={
  option:[1000,800,700,0],trs:[1000,600,0,0],ks:[800,800,600,600],fast:[900,0,700,500],
  'option-no-event':[1000,1000,1000,0],'option-no-rate':[1000,1000,1000,0],
  'option-null-initial':[null,0,0,0],'trs-no-record':[1000,0,0,0],'trs-no-rate':[1000,0,0,0],
  'ks-no-record':[null,null,null,null],'fast-no-rate':[0,0,0,0],
  'same-day-events':[1000,750,650,0],'trs-duplicate-leg':[1000,1200,0,0],
  'fee-window-anchor':[1000,800,700,0],'ks-window-anchor':[800,800,800,800],
};
for(const kind of [...Object.keys(expectedAmounts),'lookback-window','ended-before-window','invalid-period','end-at-cutoff']) {
  test('107491 synthetic original vs modules: '+kind,()=>{
    const db=new DatabaseSync(':memory:');
    try {
      setup(db,fixture(kind));
      const run=sql=>db.prepare(sqliteSql(sql)).all();
      const result=run(render()), expected=run(original);
      const bag=rs=>rs.map(r=>JSON.stringify(Object.values(r))).sort();
      assert.deepEqual(bag(result),bag(expected),'all 23 values and row multiplicity');
      result.sort((a,b)=>a.Busi_Date.localeCompare(b.Busi_Date));
      if(expectedAmounts[kind]) {
        assert.equal(result.length,4);
        assert.deepEqual(result.map(r=>r.Dyna_Nom_Prin),expectedAmounts[kind]);
      }
      if(kind==='ks') {
        assert.deepEqual(result.map(r=>r.Inta),[-10,-10,-6,-6]);
        assert.deepEqual(result.map(r=>r.Trd_Cms),[8,0,3,0]);
        assert.deepEqual(result.map(r=>r.Marg_Prop),[0.2,0.2,0.3,0.3]);
      }
      if(kind==='lookback-window'||kind==='ended-before-window') {
        assert.equal(result.length,151);
        assert.equal(result[0].Busi_Date,addDays(day,-150));
        assert.equal(result.at(-1).Busi_Date,day);
        if(kind==='ended-before-window')assert.ok(result.every(r=>r.Dyna_Nom_Prin===0));
      }
      if(kind==='invalid-period'||kind==='end-at-cutoff')assert.equal(result.length,0);
      if(kind==='fee-window-anchor')assert.deepEqual(result.map(r=>r.fee_rate),[0.15,0.15,0.15,0.15]);
      if(kind==='ks-window-anchor')assert.deepEqual(result.map(r=>r.Trd_Cms),[0,0,0,0]);
    } finally {db.close();}
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, render } from '../render.mjs';
import { scan, parse } from './sql-shape.mjs';
import { cteBodies, flattenOptionStages } from './option-stages.mjs';

const branch = JSON.parse(readFileSync(join(root,'manifest.json'),'utf8')).branches.find(b=>b.grpId==='01');
const original = parse(readFileSync(join(root,branch.reference),'utf8'));
const translated = s => s.replace(/\brb\.key_book_id\b/gi,'trade.book_key_book_id')
  .replace(/\brb\./gi,'trade.').replace(/\bPREMIUM\b(?!\s*\.)/g,'deal.PREMIUM');
const leafTables = {trade:'sale_trade',...branch.ctes,cp:'sale_customer',mp:'sale_bundle_plan',mid:'odata_n_tit.d_ref_rmb_midrate'};
const baselineJoins = original.joins.filter(j=>!['rb','tbi'].includes(j.alias)).map(j=>{
  if(j.alias==='trade')return 'from sale_trade trade';
  if(j.alias==='cp')return 'left join sale_customer cp'+j.text.slice(j.cl).replace(/^\s*cp/i,'');
  if(j.alias==='mp')return 'left join sale_bundle_plan mp on mp.bundle_id=deal.bundle_id';
  if(branch.ctes[j.alias])return j.text.slice(0,j.op)+branch.ctes[j.alias]+j.text.slice(j.cl);
  return j.text;
});
const baseline = 'SELECT '+original.fields.map(translated).join(',\n')+'\n'+baselineJoins.join('\n')+'\n'+
  original.where.replace(/\bwhere Contr_Status\b/i,'where deal.Contr_Status');

function optionQuery(sql) {
  const q=parse(sql), bodies=cteBodies(sql);
  return 'WITH '+['option_base','option_underlying','option_classified'].map(n=>n+' AS ('+bodies.get(n)+')').join(',\n')+
    '\nSELECT '+q.fields.join(',\n')+'\n'+q.joins.map(j=>j.text).join('\n')+(q.where||'');
}

function fixtureRows(kind) {
  const trade={key_otc_trade_id:'T1',internal_trade_id:'C1',key_instrument_id:'I1',key_book_id:'B1',
    book_key_book_id:'B1',department:'OTC_HK',desk:'OTCHK_QIS',book_name:'sample',business_type:'OPTION'};
  const deal={key_otc_trade_id:'T1',key_ctpty_id:'P1',bundle_id:'G1',contr_status:'EFFECTIVE',
    seller:'11613',private_placement:'N',collateral_notional_currency:'USD',settlement_currency:'USD',
    initial_notional:1000,notional:300,collateral_notional:800,early_term_date:null};
  const ds={key_otc_trade_id:'T1',underlying_ins_id:'U1',underlying_wind_code:'IDX.WI',
    contract_type:'AIRBAG',contract_sub_type:null,start_date:'2025-03-31',end_date:'2027-12-31',underlying_currency:'USD'};
  const rows={
    trade:[trade,{...trade,key_otc_trade_id:'NO_OPTION'}],
    deal:[deal,{...deal,key_otc_trade_id:'FILTERED',contr_status:'CANCELLED'}],
    ds:[ds,{...ds,start_date:'2025-04-01'}],
    c:[{key_instrument_id:'U1',interotc_underlying_category:'BONDS'}],
    ins:[{key_instrument_id:'U1',ins_family:'EQUITY',ins_sht_desc:'single',ins_lng_desc:'single long'}],
    bc:[{key_instrument_id:'U1',ins_family:'QIS',ins_sht_desc:'basket',ins_lng_desc:'basket long',future_type:'F'}],
    fu:[],sutd:[{dw_cd_val:'QIS',dw_cd_val_desc:'QIS type'}],
    sct:[{dw_cd_val:'AIRBAG',dw_cd_val_desc:'AIRBAG type'}],
    ssct:[],rcm:[{key_ctpty_id:'P1',outside_ctpty_code:'OUT1'}],
    cp:[{client_id:'OUT1',corporate_name:'sample customer'}],
    ods:[{key_otc_trade_id:'T1',net_pnl:7}],
    calc:[{key_instrument_id:'I1',key_book_id:'B1',rk:1,initial_npv:10},
      {key_instrument_id:'I1',key_book_id:'B1',rk:2,initial_npv:20}],
    mid:[{currency:'USD',quote_date:'2025-03-31',midrate:7}],
  };
  rows.trade.push({...trade,key_otc_trade_id:'FILTERED'});
  if(kind==='duplicates'){
    for(const name of ['ins','sct','rcm','cp']) rows[name].push({...rows[name][0]});
    rows.ods.push({...rows.ods[0],net_pnl:8},{...rows.ods[0],net_pnl:9});
  }
  if(kind==='missing'){
    for(const name of ['ds','c','ins','bc','sutd','sct','rcm','cp','ods','calc','mid'])rows[name]=[];
  }
  if(kind==='empty-basket'){
    rows.bc[0].ins_family=''; rows.bc[0].ins_sht_desc=''; rows.bc[0].ins_lng_desc='';
  }
  return rows;
}

for(const kind of ['normal','duplicates','missing','empty-basket']){
  test('01 option stage multiset: '+kind,()=>{
    const sql=render(branch.name), actual=optionQuery(sql), bodies=cteBodies(sql);
    flattenOptionStages(sql);
    const columns=new Map(Object.keys(leafTables).map(a=>[a,new Set()]));
    const text=[baseline,...['option_base','option_underlying','option_classified'].map(n=>bodies.get(n))].join('\n');
    const t=scan(text);
    for(let i=0;i<t.length-2;i++){
      if(t[i+1].text==='.'&&columns.has(t[i].text.toLowerCase())){
        columns.get(t[i].text.toLowerCase()).add(t[i+2].text.toLowerCase());
      }
    }
    const rows=fixtureRows(kind), db=new DatabaseSync(':memory:');
    const quote=name=>'"'+name.replaceAll('"','""')+'"';
    try{
      db.function('if',(condition,a,b)=>condition?a:b);
      db.function('nvl',(a,b)=>a??b);
      db.function('concat',{varargs:true},(...args)=>args.some(a=>a===null)?null:args.join(''));
      db.function('substring',(s,start,length)=>s===null?null:String(s).slice(start-1,start-1+length));
      for(const [alias,table] of Object.entries(leafTables)){
        for(const row of rows[alias]||[])for(const key of Object.keys(row))columns.get(alias).add(key);
        const names=[...columns.get(alias)];
        assert.ok(names.length,'fixture schema for '+alias);
        db.exec('CREATE TABLE '+quote(table)+' ('+names.map(quote).join(',')+')');
        const insert=db.prepare('INSERT INTO '+quote(table)+' VALUES ('+names.map(()=>'?').join(',')+')');
        for(const row of rows[alias]||[])insert.run(...names.map(n=>row[n]??null));
      }
      const executable=s=>s.replaceAll('odata_n_tit.d_ref_rmb_midrate',quote('odata_n_tit.d_ref_rmb_midrate'))
        .replaceAll('$'+'{data_day_str}','2026-09-18').replaceAll('$'+'{filename}','sample').replaceAll('$'+'{data_today}','2026-09-18');
      const run=s=>db.prepare(executable(s)).all().map(row=>Object.values(row));
      const expected=run(baseline), result=run(actual);
      const multiset=rs=>rs.map(r=>JSON.stringify(r)).sort();
      assert.deepEqual(multiset(result),multiset(expected),'same values AND duplicate row multiplicities');
      assert.equal(result.length,kind==='duplicates'?96:kind==='missing'?1:2);
      if(kind==='normal'){
        assert.ok(result.some(row=>row[8]==='OPTION_N_CROSS_QTF_STRG_IDX'));
        assert.ok(result.every(row=>row[19]==='BOND'),'display BOND must not replace classification QIS');
      }
    }finally{db.close();}
  });
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,render} from '../render.mjs';
import {parse} from './sql-shape.mjs';
import {cteBodies} from './option-stages.mjs';
import {inlineKingstarSteps} from './kingstar-stages.mjs';

const original=parse(readFileSync(join(root,'06_原始SQL/86842.sql'),'utf8'));
const baseline='SELECT '+original.fields.join(',\n')+'\n'+original.joins.map(j=>j.text).join('\n')+'\n'+original.where;
const stages=['sale_customer','ranked_confirmations','latest_confirmation','contract_type_dictionary',
  'ranked_positions','latest_positions','position_details','underlying_summary'];
const day='2026-09-18';
const tables={
  confirmation:'odata_n_tit.d_ks_trade_comfirm_info',
  position:'odata_n_tit.d_ks_trs_eod_postion',
  instrument:'odata_n_tit.d_ref_instrument',
  dictionary:'pdata_n.ref_dw_cd_val',
  customer:'odata_n_ois.o_otc_derivative_counterparty',
};
const columns={
  confirmation:['busi_date','key_trade_comfirm_id','business_date','contract_code','counterparty_id','trs_type',
    'seller','notional','dynamic_notional','start_date','end_date','early_termination_date','payment_date',
    'time_to_maturity','contr_status','mgr_rate'],
  position:['busi_date','key_trade_comfirm_id','underlying_wind_code','wind_name','src_busi_date','quantity'],
  instrument:['busi_date','wind_code','ins_lng_desc','ins_family','currency'],
  dictionary:['dw_cd_id','dw_cd_val','dw_cd_val_desc','remark'],
  customer:['busi_date','client_id','abbreviation','corporate_name','signature_name','industry','aptitude',
    'commission_rate','client_qualify_review','delete_flag','department'],
};
function fixture(kind){
  const current={busi_date:day,key_trade_comfirm_id:'C1',business_date:day,contract_code:'MASTER1',
    counterparty_id:'P1',trs_type:'B_LONG_SHORT_SWAP',seller:'GFZQ',notional:1000,dynamic_notional:800,
    start_date:'2025-01-01',end_date:'2027-01-01',contr_status:'EFFECTIVE',mgr_rate:0.2};
  const rows={
    confirmation:[{...current,business_date:'2026-09-17',notional:700,dynamic_notional:600},current],
    position:[
      {busi_date:day,key_trade_comfirm_id:'C1',underlying_wind_code:'W1',wind_name:'old1',src_busi_date:'2026-09-14',quantity:3},
      {busi_date:day,key_trade_comfirm_id:'C1',underlying_wind_code:'W1',wind_name:'new1',src_busi_date:'2026-09-16',quantity:4},
      {busi_date:day,key_trade_comfirm_id:'C1',underlying_wind_code:'W2',wind_name:'new2',src_busi_date:'2026-09-15',quantity:5},
    ],
    instrument:[
      {busi_date:day,wind_code:'W1',ins_lng_desc:'full1',ins_family:'EQUITY',currency:'HKD'},
      {busi_date:day,wind_code:'W2',ins_lng_desc:'full2',ins_family:'FUTURE',currency:'USD'},
    ],
    dictionary:[
      {dw_cd_id:'CD382',dw_cd_val:'B_LONG_SHORT_SWAP',dw_cd_val_desc:'source type',remark:'TITANS场外衍生品合约类型'},
      {dw_cd_id:'CD128',dw_cd_val:'EQUITY',dw_cd_val_desc:'equity',remark:'TITANS场外衍生品标的类型'},
      {dw_cd_id:'CD128',dw_cd_val:'FUTURE',dw_cd_val_desc:'future',remark:'TITANS场外衍生品标的类型'},
    ],
    customer:[{busi_date:day,client_id:'P1',corporate_name:'customer',delete_flag:'0',department:'ED'}],
  };
  if(kind==='newest-invalid')current.contr_status='CANCELLED';
  if(kind==='missing-start')current.start_date=null;
  if(kind==='missing-position')rows.position=[];
  if(kind==='missing-customer')rows.customer=[];
  if(kind==='missing-instrument')rows.instrument=[];
  if(kind==='duplicates'){
    rows.customer.push({...rows.customer[0]});
    rows.instrument.push({...rows.instrument[0]});
    rows.dictionary.push({...rows.dictionary[0]},{...rows.dictionary[1]});
  }
  if(kind==='null-type')current.trs_type=null;
  if(kind==='null-principal'){current.notional=null;current.dynamic_notional=null;}
  if(kind==='empty-code')rows.position=[{...rows.position[1],underlying_wind_code:''}];
  if(kind==='zero-quantity')rows.position=rows.position.map(r=>({...r,quantity:0}));
  if(kind==='two-confirmations'){
    rows.confirmation.push({...current,key_trade_comfirm_id:'C2'});
    rows.position.push(...rows.position.map(r=>({...r,key_trade_comfirm_id:'C2'})));
  }
  return rows;
}
const quote=s=>'"'+s.replaceAll('"','""')+'"';
function setup(db,rows){
  db.function('if',(condition,a,b)=>condition?a:b);
  db.function('substring',(s,start,length)=>s===null?null:String(s).slice(start-1,start-1+length));
  for(const name of ['collect_list','collect_set']){
    db.aggregate(name,{start:'[]',step:(state,value)=>{
      const list=JSON.parse(state);
      if(value!==null&&(name==='collect_list'||!list.includes(value)))list.push(value);
      return JSON.stringify(list);
    }});
  }
  db.function('concat_ws',(separator,values)=>JSON.parse(values).join(separator));
  for(const[key,table]of Object.entries(tables)){
    db.exec('CREATE TABLE '+quote(table)+' ('+columns[key].map(quote).join(',')+')');
    const statement=db.prepare('INSERT INTO '+quote(table)+' VALUES ('+columns[key].map(()=>'?').join(',')+')');
    for(const row of rows[key])statement.run(...columns[key].map(k=>row[k]??null));
  }
  db.exec("CREATE VIEW v_t98_sale_counterparty AS SELECT *, 'MAINLAND' AS customer_source FROM "+quote(tables.customer)+" WHERE delete_flag='0' AND department<>'HK'");
}
function executable(sql){
  for(const table of Object.values(tables))sql=sql.replaceAll(new RegExp(table.replaceAll('.','\\.'),'gi'),quote(table));
  return sql.replaceAll('$'+'{data_day_str}',day).replaceAll('$'+'{filename}','sample').replaceAll('$'+'{data_today}',day);
}
for(const kind of ['normal','newest-invalid','missing-start','missing-position','missing-customer',
  'missing-instrument','duplicates','null-type','null-principal','empty-code','zero-quantity','two-confirmations']){
  test('03 Kingstar original vs named steps: '+kind,()=>{
    const sql=render('03_金仕达'), q=parse(sql), bodies=cteBodies(sql);
    inlineKingstarSteps(sql);
    const actual='WITH '+stages.map(n=>n+' AS ('+bodies.get(n)+')').join(',\n')+
      '\nSELECT '+q.fields.join(',\n')+'\n'+q.joins.map(j=>j.text).join('\n')+'\n'+q.where;
    const db=new DatabaseSync(':memory:');
    try{
      setup(db,fixture(kind));
      const run=s=>db.prepare(executable(s)).all().map(row=>Object.values(row));
      const expected=run(baseline),result=run(actual);
      const multiset=rs=>rs.map(r=>JSON.stringify(r)).sort();
      assert.deepEqual(multiset(result),multiset(expected),'same 90 values and duplicate multiplicity');
      const count=['newest-invalid','missing-start','missing-position'].includes(kind)?0:kind==='duplicates'?4:kind==='two-confirmations'?2:1;
      assert.equal(result.length,count);
      if(kind==='normal'){
        assert.equal(result[0][16],'new1;new2','latest chosen independently, including dates before processing day');
        assert.deepEqual(result[0].slice(24,28),[null,800,800,'0.0']);
      }
      if(kind==='null-type')assert.equal(result[0][25],1000,'other types use notional for initial principal');
      if(kind==='null-principal')assert.deepEqual(result[0].slice(24,28),[null,null,null,'0.0']);
      if(kind==='empty-code')assert.equal(result[0][15],'','empty string is not NULL');
      if(kind==='missing-customer')assert.equal(result[0][4],null);
      if(kind==='two-confirmations')assert.equal(new Set(result.map(r=>r[0])).size,2);
    }finally{db.close();}
  });
}
test('03 Kingstar reversal rejects new filtering in detail stage',()=>{
  const sql=render('03_金仕达').replace('on sutd.dw_cd_val = d.ins_family','on sutd.dw_cd_val = d.ins_family\n where d.currency is not null');
  assert.throws(()=>inlineKingstarSteps(sql),/details cannot filter rows/);
});


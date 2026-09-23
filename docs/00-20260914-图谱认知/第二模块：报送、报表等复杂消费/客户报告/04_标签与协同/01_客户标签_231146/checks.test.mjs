import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {render} from '../render.mjs';
import {scan} from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name=>readFileSync(new URL(name,import.meta.url),'utf8');
const source=JSON.parse(read('99_冻结来源.json'));
const tokens=sql=>scan(sql).map(t=>t.text);
const day='2026-09-22';
function fixture(){return {
  daily:[
    ['示例客户','U001','OPTION',500000,500000,'雪球','01',day,'2026-01-01','2026-01-01'],
    ['示例客户','U001','OPTION',100000,500000,'雪球','01',day,'2026-01-01',day],
    ['示例客户','U001','TRS',800000,800000,'多空互换','03',day,'2025-06-01','2025-06-01'],
    ['示例客户','U001','TRS',200000,800000,'多空互换','03',day,'2025-06-01',day]],
  info:[['示例客户',day,'01','EQUITY','1']],
  calls:[['P1','2026-01-15','2',day,'ODATA_N_TIT.G_MARGIN_CALL_SETTING'],
    ['P2','2026-02-15','2',day,'ODATA_N_TIT.G_MARGIN_CALL_SETTING'],
    ['P1','2026-03-15','3',day,'ODATA_N_TIT.G_MARGIN_CALL_SETTING']],
  relations:['P1','P2'].map(p=>[p,'M1','2025-01-01','9999-12-31','ODATA_N_TIT.D_REF_CTPTY_MAPPING']),
  companies:[['M1','示例客户','U001',day,'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY']]
};}

// Execute the complete delivered SELECT. JSON arrays only adapt Hive string-array
// collect_set/array/concat and outer explode. Ordering of sets is never asserted.
// Only ordinary text/NULL array elements and valid numeric fixtures are supported;
// this does not validate all Hive null/coercion/DECIMAL semantics or live UDFs.
function run(input=fixture()){
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("ATTACH DATABASE ':memory:' AS DM_OTC_N; ATTACH DATABASE ':memory:' AS pdata_n");
    db.exec(`CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT(Cutp_Pty_Full_Name TEXT,USCC TEXT,Busi_Type TEXT,
      Dyna_Nom_Prin REAL,Init_Nom_Prin REAL,Contr_Type_Desc TEXT,grp_id TEXT,busi_date TEXT,Strt_Pric_Date TEXT,Accrued_Date TEXT);
      CREATE TABLE pdata_n.T98_OTC_DERI_COMP_SALE_INFO(Cutp_Pty_Full_Name TEXT,busi_date TEXT,grp_id TEXT,Src_Undrl_Type TEXT,Res_Flag TEXT);
      CREATE TABLE pdata_n.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO(Pty_Id TEXT,Perf_Marg_Date TEXT,Defr_Days TEXT,Busi_Date TEXT,Src_Tbl TEXT);
      CREATE TABLE pdata_n.T01_PTY_RELA_H(Pty_Id TEXT,Rela_Pty_Id TEXT,STRT_DATE TEXT,END_DATE TEXT,SRC_TBL TEXT);
      CREATE TABLE pdata_n.T01_CORP_CUST(PTY_ID TEXT,ORG_FULL_NAME_CH TEXT,USCC TEXT,BUSI_DATE TEXT,SRC_TBL TEXT)`);
    db.aggregate('collect_set',{start:()=>[],step:(set,value)=>{if(value!=null){assert.equal(typeof value,'string');if(!set.includes(value))set.push(value);}return set;},result:JSON.stringify});
    db.function('array',{varargs:true},(...values)=>JSON.stringify(values));
    db.function('concat',{varargs:true},(...arrays)=>JSON.stringify(arrays.flatMap(value=>{
      assert.equal(typeof value,'string');const array=JSON.parse(value);assert.ok(Array.isArray(array));return array;
    })));
    for(const [table,rows,n] of [['DM_OTC_N.OTC_REV_DAILY_RPT',input.daily,10],
      ['pdata_n.T98_OTC_DERI_COMP_SALE_INFO',input.info,5],['pdata_n.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO',input.calls,5],
      ['pdata_n.T01_PTY_RELA_H',input.relations,5],['pdata_n.T01_CORP_CUST',input.companies,5]]){
      const stmt=db.prepare(`INSERT INTO ${table} VALUES (${Array(n).fill('?').join(',')})`);for(const row of rows)stmt.run(...row);
    }
    let sql=render('01_客户标签_231146').replaceAll('${yyyy-MM-dd}',day).replaceAll('${yyyy,-1y}','2025');
    const lateral='lateral view outer explode(s.tag_arr) t as tag_name';assert.ok(sql.includes(lateral));
    sql=sql.replace(lateral,'left join json_each(s.tag_arr) t on 1=1').replaceAll('t.tag_name','t.value');
    return db.prepare(sql).all().map(r=>({...r}));
  } finally {db.close();}
}
const tags = rows=>rows.map(r=>r.tag_name).sort();
const advanced = rows=>rows.some(r=>r.tag_name==='有垫资');

test('current frozen bytes, expanded query tokens, DDL and four-column order',()=>{
  assert.equal(createHash('sha256').update(source.raw).digest('hex'),'d6e8df15ac86a1eaf3dfedda96cdb5c71b6b7c9ddf5ef54da62a8d9f75f7905a');
  assert.equal(createHash('sha256').update(source.query).digest('hex'),source.querySha256);
  assert.deepEqual(tokens(render('01_客户标签_231146')),tokens(source.query));
  assert.deepEqual(tokens(read('05_目标表结构.sql')),tokens(source.ddl));
  assert.equal(read('完整SQL.sql'),render('01_客户标签_231146'));
  assert.deepEqual(Object.keys(run()[0]),['company_name','company_id','tag_name','busi_date']);
});

test('one company two start-day contracts and three qualifying dates produce eight explained labels',()=>{
  const result=run();assert.equal(result.length,8);
  assert.deepEqual(tags(result),['前十大期权客户','前十大互换客户','雪球','多空互换','定增客户','单笔交易小','高换手','有垫资'].sort());
  assert.ok(result.every(r=>r.company_name==='示例客户'&&r.company_id==='U001'&&r.busi_date===day));
});

test('dense-rank top ten can contain eleven clients and excludes only the eleventh rank',()=>{
  const f=fixture();f.daily=[];f.calls=[];f.info=[];
  for(let i=1;i<=9;i++)f.daily.push(['客户'+i,'U'+i,'OPTION',(20-i)*1000,1000000,'类型','01',day,'2025-01-01',day]);
  for(const [id,amount]of[['并列A',1000],['并列B',1000],['第十一名',500]])f.daily.push([id,id,'OPTION',amount,1000000,'类型','01',day,'2025-01-01',day]);
  const result=run(f);assert.equal(result.length,11);assert.ok(!result.some(r=>r.company_id==='第十一名'));
});

test('historical average uses start rows; current balances do not alter small-trade label',()=>{
  const f=fixture();f.daily[1][4]=100000000;f.daily[3][4]=100000000;
  assert.ok(tags(run(f)).includes('单笔交易小'));
  f.daily[0][4]=1000000;f.daily[2][4]=1000000;assert.ok(!tags(run(f)).includes('单笔交易小'));
  f.daily[0][4]=null;f.daily[2][4]=null;assert.ok(!tags(run(f)).includes('单笔交易小'));
});

test('high-turnover is grp03 presence, while private-placement signal only matches company name',()=>{
  const f=fixture();f.daily[2][6]='02';f.daily[3][6]='02';assert.ok(!tags(run(f)).includes('高换手'));
  assert.ok(tags(run(f)).includes('定增客户'));
  f.info[0][0]='不同名称';assert.ok(!tags(run(f)).includes('定增客户'));
  f.info[0][0]='示例客户';f.info[0][4]='0';assert.ok(!tags(run(f)).includes('定增客户'));
});

test('ROWS window crosses absent months and does not require three consecutive calendar months',()=>{
  const f=fixture();f.calls[1][1]='2026-03-15';f.calls[2][1]='2026-06-15';
  assert.ok(advanced(run(f)));
  f.calls[1][1]='2026-01-16';f.calls[2][1]='2026-01-17';assert.ok(advanced(run(f))); // Single month has three dates.
  f.calls.pop();assert.ok(!advanced(run(f)));
});

test('same mapped manager same date is counted once, not once per counterparty or repeated row',()=>{
  const f=fixture();f.calls[1][1]=f.calls[0][1];
  f.calls.push(f.calls[0].slice());assert.ok(!advanced(run(f)));
  f.calls[1][1]='2026-02-15';assert.ok(advanced(run(f)));
});

test('raw performance-date distinct does not first truncate time components',()=>{
  const f=fixture();f.calls.forEach((row,i)=>{row[1]=`2026-01-15 0${i+1}:00:00`;});
  assert.ok(advanced(run(f))); // String fixtures: three values on one calendar date, not three days.
});

test('advance branch is independent and uses report-day active relationships and source/date gates',()=>{
  const f=fixture();f.daily=[];assert.deepEqual(tags(run(f)),['有垫资']);
  f.relations.forEach(row=>{row[3]=day;});assert.deepEqual(run(f),[]);
  f.relations=fixture().relations;f.calls[0][2]='1';assert.deepEqual(run(f),[]);
  f.calls=fixture().calls;f.calls[0][1]='2024-12-31';assert.deepEqual(run(f),[]);
  f.calls[0][1]='2025-01-01';assert.deepEqual(tags(run(f)),['有垫资']);
  f.companies[0][4]='OTHER';assert.deepEqual(run(f),[]);
});

test('UNION ALL and array concatenation can produce duplicate visible labels',()=>{
  const f=fixture();f.daily[0][5]='高换手';f.daily[1][5]='高换手';
  assert.equal(run(f).filter(row=>row.tag_name==='高换手').length,2);
});

test('branch-specific date/group filters are not generalized across all labels',()=>{
  const f=fixture();f.daily[0][6]='04';f.daily[1][6]='04';
  assert.ok(tags(run(f)).includes('前十大期权客户'));assert.ok(tags(run(f)).includes('雪球'));
  f.daily[0][8]=f.daily[0][9]='2027-01-01';assert.ok(tags(run(f)).includes('雪球'));
  f.daily.forEach(row=>{row[7]='2026-09-21';});assert.deepEqual(tags(run(f)),['有垫资']);
});

test('ranking, physical rows, threshold and dedup mutations are rejected by token baseline',()=>{
  const actual=render('01_客户标签_231146');
  for(const [before,after]of [['dense_rank()','row_number()'],['rows between 2 preceding','rows between 1 preceding'],
    ['count(distinct m.Perf_Marg_Date)','count(m.Perf_Marg_Date)'],['t2.rolling_3mon_cnt >= 3','t2.rolling_3mon_cnt > 3']]){
    assert.ok(actual.includes(before));assert.notDeepEqual(tokens(actual.replace(before,after)),tokens(source.query));
  }
});

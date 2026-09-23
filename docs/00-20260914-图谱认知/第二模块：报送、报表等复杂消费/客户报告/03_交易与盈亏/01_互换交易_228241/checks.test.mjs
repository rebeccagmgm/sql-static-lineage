import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {render} from '../render.mjs';
import {scan} from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const tokens = sql => scan(sql).map(token => token.text);
const day = '2026-09-22';
const base = () => [
  ['U001','示例客户','TRS','A',1000000,'2025-06-01','2025-06-01',day,'类型甲','02'],
  ['U001','示例客户','TRS','B',2000000,'2026-01-01','2026-01-01',day,'类型甲','02'],
  ['U001','示例客户','TRS','C',3000000,'2026-09-01','2026-09-01',day,'类型乙','02'],
  ['U001','示例客户','TRS','D',4000000,'2024-01-01','2024-01-01',day,'类型甲','02'],
];
const masters = () => ['A','B','C','D'].map(id => [id,'I'+id,day,'02']);
const values = () => [['IA',80,20],['IB',-60,10],['IC',0,0],['ID',150,50]]
  .map(row => [...row,day,'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION']);

// Execute the complete delivered query. Only literal platform macros, Hive explode,
// ordinary ISO-date datediff and integer/integer division require explicit adapters.
// Neither zero-division, real production cardinality nor Hive DECIMAL is validated.
function run(rows=base(), info=masters(), valuation=values()) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("ATTACH DATABASE ':memory:' AS DM_OTC_N; ATTACH DATABASE ':memory:' AS pdata_n");
    db.exec(`CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT(USCC TEXT,Cutp_Pty_Full_Name TEXT,
      Busi_Type TEXT,Agt_Id TEXT,Init_Nom_Prin REAL,Accrued_Date TEXT,Strt_Pric_Date TEXT,
      busi_date TEXT,Contr_Type_Desc TEXT,grp_id TEXT);
      CREATE TABLE pdata_n.T98_OTC_DERI_COMP_SALE_INFO(Agt_Id TEXT,Inr_Seri_No TEXT,busi_date TEXT,grp_id TEXT);
      CREATE TABLE pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO(Swap_Comp_Agt_Id TEXT,
      Lcrrc_Accum_Unrlz_Yield REAL,Lcrrc_Accum_Rlz_Yield REAL,busi_date TEXT,SRC_TBL TEXT)`);
    db.function('datediff',(end,start) => {
      if (end == null || start == null) return null;
      if (![end,start].every(value=>/^\d{4}-\d{2}-\d{2}$/.test(value))) throw Error('unsupported date fixture');
      return (Date.parse(end)-Date.parse(start))/86400000;
    });
    for (const [table,data,count] of [['DM_OTC_N.OTC_REV_DAILY_RPT',rows,10],
      ['pdata_n.T98_OTC_DERI_COMP_SALE_INFO',info,4],['pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO',valuation,5]]) {
      const insert=db.prepare(`INSERT INTO ${table} VALUES (${Array(count).fill('?').join(',')})`);
      for(const row of data) insert.run(...row);
    }
    let sql=render('01_互换交易_228241').replaceAll('${yyyy-MM-dd}',day).replaceAll('${yyyy,-1y}','2025');
    const lateral="lateral view explode(array('近一年', '历史')) t as time_period";
    assert.equal(sql.split(lateral).length-1,3);
    sql=sql.replaceAll(lateral,"cross join (select '近一年' as time_period union all select '历史') t");
    assert.ok(sql.includes('t3.win_count / t3.total_count'));
    sql=sql.replace('t3.win_count / t3.total_count','t3.win_count * 1.0 / t3.total_count');
    return db.prepare(sql).all().map(row=>({...row}));
  } finally {db.close();}
}
const rowFor = (rows, period='近一年') => rows.find(row=>row.time_period===period);
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

test('current frozen source, every SQL/DDL token, expansion and 12-column order',()=>{
  assert.equal(createHash('sha256').update(source.raw).digest('hex'),'987659b2430e4f6687419d7ba09aad0b698873cbfe76588a8aac7f4e6128329b');
  assert.equal(createHash('sha256').update(source.query).digest('hex'),source.querySha256);
  assert.deepEqual(tokens(render('01_互换交易_228241')),tokens(source.query));
  assert.deepEqual(tokens(read('06_目标表结构.sql')),tokens(source.ddl));
  assert.equal(read('完整SQL.sql'),render('01_互换交易_228241'));
  assert.deepEqual(Object.keys(run()[0]),['company_name','company_id','time_period','weekly_trd_freq',
    'avg_trd_amount','trd_win_rate','yield_rate','swap_first_trd_type','swap_second_trd_type',
    'swap_first_trd_count','swap_second_trd_count','busi_date']);
});

test('four-contract example: both periods, ranking, full-query frequency and valuations',()=>{
  const results=run();assert.equal(results.length,2);
  const recent=rowFor(results), historic=rowFor(results,'历史');
  const days=(Date.parse(day)-Date.parse('2025-01-01'))/86400000;
  near(recent.weekly_trd_freq,3/(days/7));
  assert.equal(recent.avg_trd_amount,2000000);near(recent.trd_win_rate,1/3);near(recent.yield_rate,50/6000000);
  assert.deepEqual([recent.swap_first_trd_type,recent.swap_second_trd_type,recent.swap_first_trd_count,recent.swap_second_trd_count],['类型甲','类型乙',2,1]);
  near(historic.weekly_trd_freq,4/((Date.parse(day)-Date.parse('2024-01-01'))/86400000/7));
  assert.equal(historic.avg_trd_amount,2500000);near(historic.trd_win_rate,0.5);near(historic.yield_rate,250/10000000);
  assert.deepEqual([historic.swap_first_trd_count,historic.swap_second_trd_count],[3,1]);
});

test('missing valuation changes winning cohort but leaves all-openings principal denominator',()=>{
  const v=values().filter(row=>row[0]!=='IC');const recent=rowFor(run(base(),masters(),v));
  near(recent.trd_win_rate,0.5);near(recent.yield_rate,50/6000000);
  assert.equal(recent.avg_trd_amount,2000000);
  const unmatched=rowFor(run(base(),[],values()));
  assert.equal(unmatched.trd_win_rate,null);assert.equal(unmatched.yield_rate,null);
  const wrongGroup=masters().map(row=>[...row.slice(0,3),'03']);
  assert.equal(rowFor(run(base(),wrongGroup)).trd_win_rate,null);
});

test('duplicate opening rows change AVG/SUM and winning rows but not distinct contract counts',()=>{
  const rows=base();const recent=rowFor(run([...rows,rows[0]]));
  assert.equal(recent.avg_trd_amount,1750000);near(recent.trd_win_rate,2/3);near(recent.yield_rate,150/7000000);
  assert.equal(recent.weekly_trd_freq,rowFor(run()).weekly_trd_freq);
  assert.equal(recent.swap_first_trd_count,2);
  const info=masters();const doubled=rowFor(run(base(),[...info,info[0],info[0],info[0]]));
  near(doubled.trd_win_rate,4/3);near(doubled.yield_rate,350/6000000);
});

test('same customer ID under two names expands type join and shares valuation aggregation',()=>{
  const rows=base().slice(0,2);rows[1][1]='同ID另一名称';
  const result=run(rows);assert.equal(result.filter(row=>row.time_period==='近一年').length,4);
  for(const row of result) near(row.trd_win_rate,0.5);
});

test('leg values add before SUM: NULL component is ignored rather than treated as zero',()=>{
  const v=values();
  const extra=['IA',null,1000,day,'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION'];
  assert.deepEqual(run(base(),masters(),[...v,extra]),run());
  v[0][1]=null;
  const recent=rowFor(run(base(),masters(),v));near(recent.trd_win_rate,0);near(recent.yield_rate,-50/6000000);
});

test('report snapshot, start-day filter, period lower bound and source marker are effective',()=>{
  const rows=base();const normal=run();
  const extra=rows[0].slice();extra[3]='X';extra[5]='2026-09-22';
  assert.deepEqual(run([...rows,extra]),normal);
  extra[5]=extra[6];extra[7]='2026-09-21';assert.deepEqual(run([...rows,extra]),normal);
  extra[7]=day;extra[2]='OPTION';assert.deepEqual(run([...rows,extra]),normal);
  const boundary=rows[0].slice();boundary[3]='X';boundary[5]=boundary[6]='2025-01-01';
  assert.ok(rowFor(run([...rows,boundary])).weekly_trd_freq>rowFor(normal).weekly_trd_freq);
  boundary[5]=boundary[6]='2024-12-31';assert.equal(rowFor(run([...rows,boundary])).weekly_trd_freq,rowFor(normal).weekly_trd_freq);
  const wrongSource=values().map(row=>[...row.slice(0,4),'OTHER']);assert.equal(rowFor(run(rows,masters(),wrongSource)).yield_rate,null);
  rows[0][9]='04';assert.deepEqual(run(rows),normal); // No grp_id condition on revenue rows.
});

test('ranking tie has no fixed order, single type leaves second columns NULL',()=>{
  const tied=rowFor(run(base().slice(1,3)));
  assert.deepEqual(new Set([tied.swap_first_trd_type,tied.swap_second_trd_type]),new Set(['类型甲','类型乙']));
  assert.deepEqual([tied.swap_first_trd_count,tied.swap_second_trd_count],[1,1]);
  const single=rowFor(run(base().slice(0,1)));
  assert.equal(single.swap_second_trd_type,null);assert.equal(single.swap_second_trd_count,null);
});

test('unguarded denominators and cohort/join mutations remain visible in actual tokens',()=>{
  const sql=render('01_互换交易_228241');
  assert.ok(sql.includes('t3.win_count / t3.total_count'));
  assert.ok(sql.includes('t3.total_pnl / t1.total_init_nom'));
  assert.ok(!read('01_指标输出.sql').toLowerCase().includes('nullif('));
  for(const [before,after] of [['count(distinct Agt_Id)','count(Agt_Id)'],
    ["s.grp_id = '02'","s.grp_id = '03'"],['left join (','inner join (']]) {
    assert.ok(sql.includes(before));assert.notDeepEqual(tokens(sql.replace(before,after)),tokens(source.query));
  }
});

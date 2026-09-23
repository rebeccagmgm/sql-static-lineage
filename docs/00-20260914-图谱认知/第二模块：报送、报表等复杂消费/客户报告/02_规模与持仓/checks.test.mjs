import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { scan, parse } from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const sources = JSON.parse(read('99_冻结来源.json')).sources;
const names = {
  '227697': '01_每日规模_227697.sql',
  '228008': '02_业务统计_228008.sql',
  '234355': '03_标的持仓_234355.sql',
};
const hashes = {
  '227697': 'bb99543511f93506ec1d60f18632067b0f143b817afe1341dae189bd06ed0cdf',
  '228008': '1eaa87938c2eac160a0f2d6a1abf1ad1592645b9830da9911894199c957704c1',
  '234355': 'b62b7b10c1f7e65785fca70feff0b696bce488a112dc012031e6945aba91e0e7',
};
const tokens = sql => scan(sql).map(token => token.text);
const today = '2026-09-22';
const row = overrides => ({
  Agt_Id: 'A', USCC: 'U001', Cutp_Pty_Full_Name: '示例客户', grp_id: '01', Busi_Type: 'OPTION',
  Contr_Type_Desc: '欧式', Undrl_Curr: 'CNY', Undrl_Wd_Cd: 'OLD', Undrl_Name: '旧标的',
  Strt_Pric_Date: '2025-03-01', Accrued_Date: today, Init_Nom_Prin: 1000000,
  Dyna_Nom_Prin: 1000000, Curr_Rev: 10, Opt_Npv_Curr_Rev: 0, busi_date: today,
  ...overrides,
});
const fixture = () => [
  row({}),
  row({ Agt_Id: 'B', Undrl_Curr: 'HKD', Undrl_Wd_Cd: 'HK', Undrl_Name: '港股标的', Strt_Pric_Date: '2026-01-01', Accrued_Date: '2026-01-01', Init_Nom_Prin: 2000000, Dyna_Nom_Prin: 2000000, Curr_Rev: 20, Opt_Npv_Curr_Rev: 200 }),
  row({ Agt_Id: 'B', Undrl_Curr: 'HKD', Undrl_Wd_Cd: 'HK', Undrl_Name: '港股标的', Strt_Pric_Date: '2026-01-01', Init_Nom_Prin: 2000000, Dyna_Nom_Prin: 1500000, Curr_Rev: 30 }),
  row({ Agt_Id: 'C', grp_id: '02', Busi_Type: 'TRS', Contr_Type_Desc: '南下', Undrl_Wd_Cd: 'CSI', Undrl_Name: '指数标的', Strt_Pric_Date: '2025-10-01', Accrued_Date: '2025-10-01', Init_Nom_Prin: 2000000, Dyna_Nom_Prin: 2000000, Curr_Rev: 40 }),
  row({ Agt_Id: 'C', grp_id: '02', Busi_Type: 'TRS', Contr_Type_Desc: '南下', Undrl_Wd_Cd: 'CSI', Undrl_Name: '指数标的', Strt_Pric_Date: '2025-10-01', Init_Nom_Prin: 2000000, Dyna_Nom_Prin: 1000000, Curr_Rev: 50 }),
];

// Run the complete delivered SELECT. No parallel hand-coded business implementation.
// Fixed ordinary-date macro values + REAL amounts adapt this fixture to SQLite only.
function run(taskId, rows = fixture()) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("ATTACH DATABASE ':memory:' AS DM_OTC_N; CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT (Agt_Id TEXT, USCC TEXT, Cutp_Pty_Full_Name TEXT, grp_id TEXT, Busi_Type TEXT, Contr_Type_Desc TEXT, Undrl_Curr TEXT, Undrl_Wd_Cd TEXT, Undrl_Name TEXT, Strt_Pric_Date TEXT, Accrued_Date TEXT, Init_Nom_Prin REAL, Dyna_Nom_Prin REAL, Curr_Rev REAL, Opt_Npv_Curr_Rev REAL, busi_date TEXT)");
    const keys = Object.keys(row({}));
    const put = db.prepare(`INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
    rows.forEach(item => put.run(...keys.map(key => item[key] ?? null)));
    const sql = read(names[taskId]).replaceAll('${yyyy-MM-dd, -12M}', '2025-09-22')
      .replaceAll('${yyyy-MM-dd}', today).replaceAll('${yyyy,-1y}', '2025').replaceAll('${yyyy}', '2026');
    return db.prepare(sql).all().map(item => ({ ...item })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  } finally { db.close(); }
}
const current = rows => rows.filter(r => r.busi_date === today);
const business = (rows, label) => rows.find(r => r.busi_type_1 === label);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('all three frozen raw hashes, query tokens, output order and combined DDL are unchanged', () => {
  for (const source of sources) {
    assert.equal(createHash('sha256').update(source.raw).digest('hex'), hashes[source.taskId]);
    assert.deepEqual(tokens(read(names[source.taskId])), tokens(source.query));
    assert.deepEqual(parse(read(names[source.taskId])).fields.map(tokens), parse(source.query).fields.map(tokens));
  }
  assert.deepEqual(tokens(read('04_目标表结构.sql')), sources.flatMap(source => tokens(source.ddl)));
  assert.deepEqual(sources.map(source => parse(read(names[source.taskId])).fields.length), [5, 12, 8]);
});

test('shared five-row fixture: three dates of balances, not day-over-day differences', () => {
  const result = run('227697').sort((a,b) => a.busi_date.localeCompare(b.busi_date));
  assert.deepEqual(result.map(r => [r.busi_date,r.option_amount_change,r.swap_amount_change]), [
    ['2025-10-01',0,2000000], ['2026-01-01',2000000,0], [today,2500000,1000000],
  ]);
  assert.ok(result.every(r => r.company_id === 'U001' && r.company_name === '示例客户'));
});

test('same fixture: five underlying-date balances in ten-thousand units, PnL always NULL', () => {
  const result = run('234355');
  assert.equal(result.length, 5);
  assert.ok(result.every(r => r.current_pnl === null));
  assert.deepEqual(current(result).map(r => [r.underlying_code,r.hold_amount]).sort(), [['CSI',100],['HK',150],['OLD',100]]);
  assert.equal(result.find(r => r.busi_date === '2026-01-01').hold_amount, 200);
});

test('same fixture: business summary excludes old contract, separates new/current/NPV/revenue/rate', () => {
  const result = run('228008');
  assert.equal(result.length, 2);
  const option = business(result,'期权'), swap = business(result,'互换');
  assert.deepEqual([option.last_year_new_amount,option.this_year_new_amount,option.stock_size,option.cross_border_opt_amount,option.npv_revenue,option.real_pnl], [0,2000000,1500000,1500000,200,50]);
  assert.deepEqual([swap.last_year_new_amount,swap.this_year_new_amount,swap.stock_size,swap.cross_border_opt_amount,swap.npv_revenue,swap.real_pnl], [2000000,0,1000000,0,0,50]);
  near(option.profit_rate,50/1500000); near(swap.profit_rate,50/1000000);
});

test('start-day eligibility applies to business summary only; cutoff is inclusive', () => {
  const before = row({ Strt_Pric_Date: '2025-03-31' });
  const at = { ...before, Strt_Pric_Date: '2025-04-01' };
  assert.equal(run('228008',[before]).length,0); assert.equal(run('228008',[at]).length,1);
  assert.deepEqual(run('227697',[before]),run('227697',[at]));
  assert.deepEqual(run('234355',[before]),run('234355',[at]));
});

test('group 04 differs across reports; non-OPTION/TRS can survive and be labelled differently', () => {
  const fourth = row({ grp_id: '04', Strt_Pric_Date: '2026-01-01' });
  assert.equal(run('227697',[fourth]).length,1);
  assert.equal(run('228008',[fourth]).length,0); assert.equal(run('234355',[fourth]).length,0);
  const other = { ...fourth, grp_id: '01', Busi_Type: 'OTHER' };
  assert.equal(run('227697',[other]).length,0);
  assert.equal(run('228008',[other])[0].busi_type_1,'OTHER');
  assert.equal(run('234355',[other])[0].underlying_type,'互换');
  const trs = { ...other, Busi_Type: 'TRS' };
  assert.equal(run('234355',[other,trs]).length,2); // Two raw groups can look identical after display mapping.
});

test('exact twelve-month endpoints and report snapshot filters use delivered WHERE clauses', () => {
  const at = row({ Strt_Pric_Date: '2025-06-01', Accrued_Date: '2025-09-22' });
  const before = { ...at, Accrued_Date: '2025-09-21' };
  const future = { ...at, Accrued_Date: '2026-09-23' };
  for (const task of ['227697','234355']) {
    assert.equal(run(task,[at]).length,1); assert.equal(run(task,[before]).length,0); assert.equal(run(task,[future]).length,0);
  }
  assert.equal(run('228008',[before]).length,1);
  for (const task of Object.keys(names)) {
    assert.deepEqual(run(task,[...fixture(),...fixture().map(r => ({...r,busi_date:'2026-09-21'}))]),run(task));
    assert.equal(run(task,[future]).length,0);
  }
});

test('missing opening row loses new amount/NPV but not current stock; missing current row makes stock/rate zero', () => {
  const withoutOpening = fixture().filter(r => !(r.Agt_Id === 'B' && r.Accrued_Date === '2026-01-01'));
  const option = business(run('228008',withoutOpening),'期权');
  assert.deepEqual([option.this_year_new_amount,option.npv_revenue,option.real_pnl,option.stock_size], [0,0,30,1500000]);
  const withoutToday = fixture().filter(r => r.Accrued_Date !== today);
  const historical = business(run('228008',withoutToday),'期权');
  assert.deepEqual([historical.this_year_new_amount,historical.npv_revenue,historical.real_pnl,historical.stock_size,historical.profit_rate], [2000000,200,20,0,0]);
  assert.equal(current(run('227697',withoutToday)).length,0);
  assert.equal(current(run('234355',withoutToday)).length,0);
});

test('NULL, zero, negative and positive stock denominator are distinct; ratio uses income not investment return', () => {
  const one = row({ Strt_Pric_Date:'2026-01-01', Curr_Rev:50 });
  for (const amount of [null,0,-100]) {
    const result = run('228008',[{...one,Dyna_Nom_Prin:amount}])[0];
    assert.equal(result.stock_size,amount); assert.equal(result.profit_rate,0);
  }
  near(run('228008',[{...one,Dyna_Nom_Prin:100}])[0].profit_rate,0.5);
  assert.equal(run('228008',[{...one,Curr_Rev:null,Dyna_Nom_Prin:100}])[0].profit_rate,null);
  const withPriorYear = run('228008',[
    {...one,Curr_Rev:null,Dyna_Nom_Prin:100,Strt_Pric_Date:'2025-10-01'},
    {...one,Accrued_Date:'2025-10-01',Strt_Pric_Date:'2025-10-01',Curr_Rev:50,Dyna_Nom_Prin:100},
  ])[0];
  assert.equal(withPriorYear.real_pnl,0);
  assert.equal(withPriorYear.stock_size,100);
  assert.equal(withPriorYear.profit_rate,0);
  assert.equal(run('227697',[{...one,Dyna_Nom_Prin:null}])[0].option_amount_change,null);
  assert.equal(run('227697',[{...one,Dyna_Nom_Prin:null},{...one,Busi_Type:'TRS',Dyna_Nom_Prin:0}])[0].option_amount_change,0);
  assert.equal(run('228008',[{...one,Dyna_Nom_Prin:null},{...one,Accrued_Date:'2026-09-21',Dyna_Nom_Prin:100}])[0].stock_size,0);
  assert.equal(run('234355',[{...one,Dyna_Nom_Prin:null}])[0].hold_amount,null);
  assert.equal(run('234355',[{...one,Dyna_Nom_Prin:-10000}])[0].hold_amount,-1);
});

test('duplicate opening and current rows change sums; no Agt_Id-level distinct exists', () => {
  const rows = fixture();
  const opening = business(run('228008',[...rows,rows[1]]),'期权');
  assert.deepEqual([opening.this_year_new_amount,opening.npv_revenue,opening.real_pnl,opening.stock_size],[4000000,400,70,1500000]);
  const duplicateDay = [...rows,rows[2]];
  assert.equal(current(run('227697',duplicateDay))[0].option_amount_change,4000000);
  const option = business(run('228008',duplicateDay),'期权');
  assert.deepEqual([option.stock_size,option.real_pnl],[3000000,80]);
  assert.equal(current(run('234355',duplicateDay)).find(r => r.underlying_code === 'HK').hold_amount,300);
});

test('company and underlying names are grouping keys, not automatically normalized labels', () => {
  const rows = fixture(); rows[2].Cutp_Pty_Full_Name = '示例客户新名';
  assert.equal(current(run('227697',rows)).length,2);
  assert.equal(run('228008',rows).filter(r => r.busi_type_1 === '期权').length,2);
  const holdings = [...fixture(),{...fixture()[2],Undrl_Name:'港股标的新名'}];
  assert.equal(current(run('234355',holdings)).filter(r => r.underlying_code === 'HK').length,2);
  const sameName = [...fixture(),{...fixture()[2],USCC:'U002'}];
  assert.equal(current(run('227697',sameName)).length,2);
});

test('NULL currency excludes cross-border amount; a NULL business type differs by report', () => {
  const nullCurrency = fixture().map(r => ({...r,Undrl_Curr:null}));
  assert.equal(business(run('228008',nullCurrency),'期权').cross_border_opt_amount,0);
  const nullType = row({ Busi_Type:null, Strt_Pric_Date:'2026-01-01' });
  assert.equal(run('227697',[nullType]).length,0);
  assert.equal(run('228008',[nullType])[0].busi_type_1,null);
  assert.equal(run('234355',[nullType])[0].underlying_type,'互换');
});

test('changing a grouping field, threshold or balance expression fails whole-query comparison', () => {
  for (const [id,before,after] of [['227697','Dyna_Nom_Prin','Init_Nom_Prin'],['228008',"'2025-04-01'","'2025-01-01'"],['234355',', Undrl_Name,',', Undrl_Wd_Cd,']]) {
    const actual = read(names[id]); assert.ok(actual.includes(before));
    assert.notDeepEqual(tokens(actual.replace(before,after)),tokens(sources.find(s => s.taskId === id).query));
  }
});

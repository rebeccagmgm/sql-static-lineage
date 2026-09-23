import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { scan } from '../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = JSON.parse(read('99_冻结来源.json'));
const tokens = sql => scan(sql).map(token => token.text);
const reportDay = '2026-09-22';
const daily = (date, type, amount, currency = 'CNY', name = '客户甲', id = '甲USCC', snapshot = reportDay) =>
  [id, name, date, type, amount, currency, snapshot];
const reward = (quarter, amount, name = '客户甲', sourceTable = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD') =>
  [name, quarter, amount, reportDay, sourceTable];
const baseDaily = () => [
  daily('2025-03-10', 'OPTION', 40000), daily('2025-11-20', 'OPTION', 10000, 'USD'),
  daily('2025-11-20', 'TRS', 20000), daily('2026-01-06', 'OPTION', 30000),
  daily('2026-05-12', 'OPTION', -5000, 'USD'), daily('2026-09-22', 'TRS', 50000, 'USD'),
];
const baseRewards = () => [reward('202504', 8000), reward('202601', 6000), reward('202603', 4000)];

// Execute the delivered SELECT, not an independently copied business formula.
// SQLite compatibility harness only: ISO-date string year/quarter helpers and REAL inputs.
// year returns text to model Hive's numeric/text year equality at the reward join.
function run(rows = baseDaily(), rewards = baseRewards()) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("ATTACH DATABASE ':memory:' AS DM_OTC_N; ATTACH DATABASE ':memory:' AS pdata_n");
    db.exec(`CREATE TABLE DM_OTC_N.OTC_REV_DAILY_RPT (
      USCC TEXT, Cutp_Pty_Full_Name TEXT, Accrued_Date TEXT, Busi_Type TEXT,
      Curr_Rev REAL, Undrl_Curr TEXT, busi_date TEXT);
      CREATE TABLE pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM (
      Pty_Cutp_Name TEXT, Sett_Time TEXT, Dev_Dept_Rwd REAL, busi_date TEXT, src_tbl TEXT)`);
    db.function('year', value => value == null ? null : value.slice(0, 4));
    db.function('quarter', value => Math.ceil(Number(value.slice(5, 7)) / 3));
    db.function('concat', { varargs: true }, (...values) => values.join(''));
    const insertDaily = db.prepare('INSERT INTO DM_OTC_N.OTC_REV_DAILY_RPT VALUES (?,?,?,?,?,?,?)');
    const insertReward = db.prepare('INSERT INTO pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM VALUES (?,?,?,?,?)');
    for (const row of rows) insertDaily.run(...row);
    for (const row of rewards) insertReward.run(...row);
    const sql = read('01_年度创收.sql').replaceAll('${yyyy-MM-dd}', reportDay)
      .replaceAll('${yyyy,-1y}', '2025').replaceAll('${yyyy}', '2026');
    return db.prepare(sql).all().map(row => ({ ...row })).sort((a, b) =>
      `${a.company_id}/${a.busi_year}`.localeCompare(`${b.company_id}/${b.busi_year}`));
  } finally { db.close(); }
}

test('query and DDL retain every non-comment token and frozen hashes', () => {
  const expected = {
    query: 'f2629b4e488323533ff5de3bfbb36e7e5e99eb82c2441027df2a40cbeee3ba77',
    prepare: '1f56e5c2720653e3b68324d96090de4ca8782772425a26bf138dc43a15c031d4',
  };
  for (const slot of source.slots) {
    assert.equal(createHash('sha256').update(slot.content).digest('hex'), expected[slot.slot]);
    assert.deepEqual(tokens(read(slot.slot === 'query' ? '01_年度创收.sql' : '02_目标表结构.sql')), tokens(slot.content));
  }
});

test('same customer multiple contracts across two years: independent totals and seven-column order', () => {
  const result = run();
  assert.deepEqual(result, [
    { company_name: '客户甲', company_id: '甲USCC', option_revenue: 5, swap_revenue: 2, cross_sale_amount: 0.8, cross_border_revenue: 1, busi_year: '2025' },
    { company_name: '客户甲', company_id: '甲USCC', option_revenue: 2.5, swap_revenue: 5, cross_sale_amount: 1, cross_border_revenue: 4.5, busi_year: '2026' },
  ]);
  assert.deepEqual(Object.keys(result[0]), ['company_name', 'company_id', 'option_revenue', 'swap_revenue', 'cross_sale_amount', 'cross_border_revenue', 'busi_year']);
});

test('report snapshot, date bounds, business types and source/quarter filters are effective', () => {
  const additions = [daily('2024-12-31', 'OPTION', 999999), daily('2026-09-23', 'OPTION', 999999),
    daily('2026-09-22', 'OPTION', 999999, 'CNY', '客户甲', '甲USCC', '2026-09-21'),
    daily('2026-09-22', 'OTHER', 999999)];
  assert.deepEqual(run([...baseDaily(), ...additions], [...baseRewards(), reward('202604', 999999),
    reward('202404', 999999), reward('202603', 999999, '客户甲', 'OTHER')]), run());
  assert.equal(run([daily('2025-01-01', 'OPTION', 10000)])[0].option_revenue, 1);
});

test('changing only USD to CNY removes overlap, not swap income', () => {
  const rows = baseDaily(); rows[5][5] = 'CNY';
  const current = run(rows)[1];
  assert.equal(current.swap_revenue, 5);
  assert.equal(current.cross_border_revenue, -0.5);
});

test('changing only customer name loses reward match; reward-only customer cannot enter', () => {
  assert.equal(run(baseDaily(), [reward('202603', 10000, '客户甲旧名')])[1].cross_sale_amount, 0);
  assert.equal(run([], baseRewards()).length, 0);
});

test('NULL amounts are not generally converted to zero; zero is preserved', () => {
  const nullOnly = run([daily('2026-09-22', 'OPTION', null, null)], []);
  assert.equal(nullOnly[0].option_revenue, null);
  assert.equal(nullOnly[0].cross_border_revenue, 0);
  assert.equal(nullOnly[0].cross_sale_amount, 0);
  assert.equal(run([daily('2026-09-22', 'OPTION', 0)])[0].option_revenue, 0);
  assert.equal(run([daily('2026-09-22', 'OPTION', null), daily('2026-09-22', 'TRS', 1)])[0].option_revenue, 0);
});

test('duplicate source rows are summed; same name under two USCCs repeats annual reward', () => {
  assert.equal(run([...baseDaily(), baseDaily()[5]])[1].swap_revenue, 10);
  const result = run([daily('2026-01-01', 'OPTION', 10000), daily('2026-01-01', 'OPTION', 10000, 'CNY', '客户甲', '另一个USCC')]);
  assert.equal(result.length, 2);
  assert.equal(result.reduce((sum, row) => sum + row.cross_sale_amount, 0), 2);
});

test('key semantic mutations fail the frozen-token comparison', () => {
  const actual = read('01_年度创收.sql');
  for (const [before, after] of [['left join', 'inner join'], ["Undrl_Curr != 'CNY'", "Undrl_Curr = 'CNY'"], ['t1.busi_year = t2.busi_year', 't1.busi_year != t2.busi_year']]) {
    assert.ok(actual.includes(before));
    assert.notDeepEqual(tokens(actual.replace(before, after)), tokens(source.slots.find(slot => slot.slot === 'query').content));
  }
});

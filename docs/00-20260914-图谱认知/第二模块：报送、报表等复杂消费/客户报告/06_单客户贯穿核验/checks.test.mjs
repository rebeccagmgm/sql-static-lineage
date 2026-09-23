import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const evidence = JSON.parse(read('02_查询结果.json'));
const rows = key => evidence.queries[key].rows;

// Exact decimal arithmetic for the returned money strings; no floating-point equality.
function cents(value) {
  assert.match(value, /^-?\d+(?:\.\d{1,2})?$/);
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -n : n;
}
const sum = (records, field) => records.reduce((n, row) => n + cents(row[field]), 0n);
const roundPositiveDivision = (n, divisor) => {
  assert.ok(n >= 0n && divisor > 0n);
  return (n + divisor / 2n) / divisor;
};

test('scope remains one historical test sample, not successful warehouse reconciliation', () => {
  assert.equal(evidence.environment, 'TEST_ONLY');
  assert.equal(evidence.reportDay, '2026-03-25');
  assert.equal(evidence.upstreamAttempt.status, 'FAILED_AUTH');
  assert.equal(evidence.upstreamAttempt.rowsReturned, false);
  assert.equal(evidence.upstreamAttempt.automaticRetry, false);
  assert.equal(evidence.sampleSelection.optionStock, '0.0');
  assert.equal(evidence.freshness.rows.length, 9);
  const empty = evidence.freshness.rows.filter(x => x.rows_n === '0').map(x => x.result_table);
  assert.deepEqual(empty.sort(), ['cross_sale', 'underlying_analysis']);
});

test('delivered read-only SQL retains every captured query template and its limit', () => {
  const sql = read('01_案例取数.sql');
  const sections = [...sql.matchAll(/^-- \[([^\]]+)\][^\n]*\n([\s\S]*?)(?=\n-- \[|$)/gm)];
  assert.equal(sections.length, 13);
  for (const [, key, body] of sections) {
    const query = key === 'freshness' ? evidence.freshness.query : evidence.queries[key].query;
    assert.equal(body.trim().replace(/;$/, ''), query);
    assert.match(query, /^SELECT /);
    assert.match(query, /LIMIT \d+$/);
    assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  }
});

test('three observed days match a 100-million scale after rounding, not a proven conversion cause', () => {
  const comparison = rows('comparison_days');
  for (const row of rows('daily')) {
    const sameDay = comparison.find(x => x.busi_date === row.busi_date);
    assert.ok(sameDay);
    assert.equal(roundPositiveDivision(cents(sameDay.swap_stock_yuan), 100000000n), cents(row.swap_amount_change));
  }
  const swap = rows('business').filter(x => x.busi_type_1 === '互换');
  assert.equal(sum(swap, 'stock_size'), 181927673175n);
  assert.equal(sum(rows('business').filter(x => x.busi_type_1 === '期权'), 'stock_size'), 0n);
});

test('business, holding and margin amounts are compared in the same unit without claiming equal scope', () => {
  const stock = sum(rows('business'), 'stock_size');
  const holding = cents(rows('hold')[0].hold_wan);
  assert.equal(stock - holding * 10000n, 23175n); // 231.75 yuan, not exact equality.
  const index = rows('index')[0];
  assert.equal(cents(index.outst_margin_amount), cents(index.used_quota));
  assert.equal(cents(index.used_quota) - holding, 3408453n); // 34,084.53 ten-thousand yuan.
});

test('annual and business income retain both value difference and different synchronization times', () => {
  const annual = rows('year').find(x => x.year === '2026');
  const swapIncome = sum(rows('business').filter(x => x.busi_type_1 === '互换'), 'real_pnl');
  assert.equal(swapIncome, 152238010n);
  assert.equal(swapIncome - cents(annual.swap_revenue) * 10000n, 15808010n);
  assert.equal(annual.synced_at, '2026-03-23 11:16:38');
  assert.equal(rows('business')[0].synced_at, '2026-03-26 16:21:18');
  // A load time is not substituted for the absent annual source snapshot date.
  assert.ok(!Object.hasOwn(annual, 'busi_date'));
});

test('NULL checks and schema mismatch cannot be presented as verified zero PnL', () => {
  const holding = rows('hold')[0];
  assert.equal(holding.null_pnl_rows, holding.rows_n);
  assert.equal(holding.rows_n, '67');
  assert.equal(holding.pnl_wan, '');
  assert.ok(rows('hold_columns').some(x => x.COLUMN_NAME === 'underlying_type'));
  assert.ok(!rows('hold_columns').some(x => x.COLUMN_NAME === 'underlying_code'));
  const source = read('../03_交易与盈亏/02_持仓盈亏_227869/06_结果匹配与比例.sql');
  assert.match(source, /COALESCE\(pnl\.profit_loss, 0\) \/ 10000 as current_pnl/);
  for (const row of rows('dates_null')) assert.equal(row.null_dates, row.rows_n);
  for (const value of Object.values(rows('nulls')[0])) assert.equal(value, '1');
});

test('transport evidence is fingerprinted and the semicolon-name exclusion really drops NULL too', () => {
  for (const source of evidence.transportEvidence) {
    assert.equal(createHash('sha256').update(source.querySql).digest('hex'), source.querySha256);
    assert.equal(source.syncQuerySame, true);
    assert.ok(source.observedAt > evidence.reportDay); // Later configuration is not March execution evidence.
  }
  const transfer = evidence.transportEvidence.find(x => x.taskId === '230263');
  assert.match(transfer.querySql, /underlying_name not like '%;%'/);
  assert.doesNotMatch(transfer.querySql, /underlying_code/);
  const db = new DatabaseSync(':memory:');
  try {
    const result = db.prepare("WITH sample(underlying_name) AS (VALUES ('标的甲'),('甲;乙'),(NULL)) SELECT underlying_name FROM sample WHERE underlying_name not like '%;%'").all();
    assert.deepEqual(result.map(x => x.underlying_name), ['标的甲']);
  } finally { db.close(); }
  const amount = evidence.transportEvidence.find(x => x.taskId === '230265').querySql;
  assert.doesNotMatch(amount, /100000000|ROUND\s*\(/i);
});

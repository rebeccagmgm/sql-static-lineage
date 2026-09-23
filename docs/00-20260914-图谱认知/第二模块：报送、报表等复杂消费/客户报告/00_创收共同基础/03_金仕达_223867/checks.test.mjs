import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {render} from '../render.mjs';
import {scan, parse} from '../../../公共加工/01_合约主信息/sql/checks/sql-shape.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const frozen = JSON.parse(read('../99_证据/223867_20260922平台来源.json'));
const tokens = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);

test('assembled query preserves all frozen tokens and 74 ordered output columns', () => {
  const actual = render('03_金仕达_223867');
  assert.deepEqual(tokens(actual), tokens(frozen.query));
  assert.equal(parse(actual).fields.length, 74);
  assert.deepEqual(parse(actual).fields.map(tokens), parse(frozen.query).fields.map(tokens));
  assert.equal(read('完整SQL.sql'), actual);
  assert.equal(createHash('sha256').update(frozen.query).digest('hex'), frozen.querySha256);
  assert.deepEqual(tokens(read('07_目标表结构.sql')), tokens(frozen.ddl));
});

function withDatabase(run) {
  const db = new DatabaseSync(':memory:');
  try { return run(db); } finally { db.close(); }
}

// Numeric teaching adapter only: SQLite LEAD / IIF + finite maximum, not Hive/UDF execution.
function income(input = {}) {
  return withDatabase(db => {
    db.function('finite_max', (a, b) => {
      assert.equal(typeof a, 'number'); assert.equal(typeof b, 'number');
      assert.ok(Number.isFinite(a) && Number.isFinite(b));
      return Math.max(a, b);
    });
    const expression = read('02_当日创收.sql').replace(/,\s*$/, '')
      .replace(/\bif\s*\(/gi, 'iif(').replace(/default\.gfgreatest\s*\(/gi, 'finite_max(');
    const values = {type:'B_LONG_SHORT_SWAP', interest:600, commission:150,
      occupy:4000000, remain:1000000, rate:0.0365, trade:2000000, fee:15, ...input};
    return db.prepare(`WITH info AS (SELECT ? Src_Contr_Type),
      co AS (SELECT ? ks_other_profit, ? ks_long_fee),
      bc AS (SELECT ? actual_occupy_amt, ? remain_contract),
      fc AS (SELECT ? fund_cost_rate), tc AS (SELECT ? long_trade_amount),
      cas AS (SELECT ? cust_total_fee)
      SELECT ${expression} FROM info CROSS JOIN co CROSS JOIN bc CROSS JOIN fc CROSS JOIN tc CROSS JOIN cas`)
      .get(values.type, values.interest, values.commission, values.occupy, values.remain, values.rate, values.trade, values.fee).Curr_Rev;
  });
}

test('actual interest and commission windows use opposite differences including first-row default', () => {
  withDatabase(db => {
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_lss; CREATE TABLE odata_n_lss.s_v_confirmation_overview(contract_code TEXT,clear_date TEXT,ks_other_profit REAL,ks_long_fee REAL);");
    const put = db.prepare('INSERT INTO odata_n_lss.s_v_confirmation_overview VALUES (?,?,?,?)');
    put.run('A','20260918',1000,500); put.run('A','20260921',400,650); put.run('A','20260922',-100,900);
    const rows = db.prepare(read('03_当日利息与佣金.sql')).all();
    assert.deepEqual(rows.map(r => [r.clear_date,r.ks_other_profit,r.ks_long_fee]),
      [['20260918',-1000,500],['20260921',600,150],['20260922',500,250]]);
  });
});

test('actual trade and agent-fee windows yield daily changes, with fee distinct preserved', () => {
  withDatabase(db => {
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_lss; CREATE TABLE odata_n_lss.s_gf_bk_contract(contract_code TEXT,clear_date TEXT,long_trade_amount REAL); CREATE TABLE odata_n_lss.m_t_cmp_agent_stat(contract_code TEXT,trade_date TEXT,cust_total_fee REAL,busi_date TEXT);");
    for (const row of [['A','20260918',10000000],['A','20260921',12000000],['A','20260922',15000000]]) {
      db.prepare('INSERT INTO odata_n_lss.s_gf_bk_contract VALUES (?,?,?)').run(...row);
    }
    for (const row of [['A','2026-09-18',20],['A','2026-09-21',35],['A','2026-09-21',35],['A','2026-09-22',50]]) {
      db.prepare('INSERT INTO odata_n_lss.m_t_cmp_agent_stat VALUES (?,?,?,?)').run(...row,'2026-09-22');
    }
    assert.deepEqual(db.prepare(read('04_当日成交金额.sql')).all().map(r=>r.long_trade_amount),[10000000,2000000,3000000]);
    assert.deepEqual(db.prepare(read('05_当日报盘费.sql').replaceAll('${yyyy-MM-dd}','2026-09-22')).all().map(r=>r.cust_total_fee),[20,15,15]);
  });
});

test('two-day income example and annual-unit contribution follow the delivered expression', () => {
  const first = income();
  const second = income({interest:500,commission:250,occupy:2000000,remain:500000,trade:3000000});
  assert.ok(Math.abs(first-306.8)<1e-9);
  assert.ok(Math.abs(second-392.7)<1e-9);
  assert.ok(Math.abs((first+second)/10000-0.06995)<1e-12);
});

test('missing rate is not zero; negative net occupation is floored; type gate is preserved', () => {
  assert.equal(income({rate:null}), null);
  assert.ok(Math.abs(income({remain:5000000})-606.8)<1e-9);
  assert.equal(income({type:'OTHER',rate:null}),0);
  assert.equal(income({interest:null,commission:null,trade:null,fee:null}),-300);
  // A missing rate remains NULL even when occupation is floored to zero.
  assert.equal(income({remain:5000000,rate:null}),null);
});

test('actual effective-date window switches rate on the new date and ends on report day', () => {
  withDatabase(db => {
    // Only valid ISO dates and integer offsets are adapted; malformed/null UDF input is outside scope.
    const offset = (date, days) => {
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(Number.isInteger(days));
      const result = new Date(date + 'T00:00:00Z');
      result.setUTCDate(result.getUTCDate() + days);
      return result.toISOString().slice(0,10);
    };
    db.function('date_add', offset); db.function('date_sub', (date,days)=>offset(date,-days));
    db.exec("ATTACH DATABASE ':memory:' AS odata_n_ois; CREATE TABLE odata_n_ois.g_client_revenue_coefficient(value REAL,effective_date TEXT,busi_date TEXT,is_del TEXT,contract_type TEXT,coefficient_type TEXT);");
    const insert = db.prepare('INSERT INTO odata_n_ois.g_client_revenue_coefficient VALUES (?,?,?,?,?,?)');
    insert.run(0.0365,'2026-09-01','2026-09-22','N','KS_LONG_SHORT_SWAP','FUND_COST_RATE');
    insert.run(0.073,'2026-09-22','2026-09-22','N','KS_LONG_SHORT_SWAP','FUND_COST_RATE');
    insert.run(0.9,'2026-09-10','2026-09-22','Y','KS_LONG_SHORT_SWAP','FUND_COST_RATE');
    const actualInner = parse(read('06_资金成本有效期.sql')).joins[0].body;
    const rows = db.prepare(actualInner.replaceAll('${yyyy-MM-dd}','2026-09-22')).all();
    assert.deepEqual(rows.map(r=>[r.value,r.strt_date,r.end_Date]),
      [[0.0365,'2026-09-01','2026-09-21'],[0.073,'2026-09-22','2026-09-22']]);
    assert.ok(Math.abs(income({rate:rows[1].value})-6.8)<1e-9);
  });
});

test('frozen calendar join and effective-rate boundary remain literal, not mocked as verified UDFs', () => {
  const main = read('00_主脚本.sql');
  assert.ok(main.includes('default.pretradedate(date_add(det.busi_date,1),1)'));
  const rate = read('06_资金成本有效期.sql');
  assert.ok(rate.includes("date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1))"));
  assert.ok(rate.includes("contract_type = 'KS_LONG_SHORT_SWAP'"));
  assert.ok(rate.includes("coefficient_type = 'FUND_COST_RATE'"));
  assert.ok(!rate.includes('partition by currency'));
});

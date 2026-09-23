import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {scan, parse} from '../01_合约主信息/sql/checks/sql-shape.mjs';
import {expand as expandIncome} from '../../销售与经营分析/118141_交叉销售收入/render.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(root, name), 'utf8');
const tokens = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);
const original = read('../04_经营系数_价差/99_证据/证据_118141.sql').split('\n');
const canonical = name => expandIncome(name);
function canonicalFields(aliases) {
  const fields = parse(canonical('01_合约日与资料.sql')).fields;
  return aliases.map(alias => {
    const field = fields.find(f => scan(f).at(-1)?.text.toLowerCase() === alias.toLowerCase());
    assert.ok(field, 'canonical output field: ' + alias);
    return scan(field).map(t => t.text).join(' ');
  }).join(',\n') + ',\n';
}
const names = {133055: '01_合约级基准生产_133055.sql', 133056: '02_类型级基准生产_133056.sql'};
const contractJoin = () => read('03_合约基准匹配_118141.sql');
const typeJoin = () => read('04_类型基准适用期_118141.sql');
const outputFields = () => canonicalFields(['Annu_Base','Absl_Base','Adtnl_Rwd']);

test('legacy base display file is navigation only; canonical income still matches frozen CASE',()=>{
  const pointer=read('05_基准选择与奖励展示_118141.sql');
  assert.deepEqual(tokens(pointer),[]);
  assert.ok(pointer.includes('01_合约日与资料.sql'));
  assert.ok(pointer.includes('02_原始当日收入.sql'));
  assert.deepEqual(tokens(canonical('02_原始当日收入.sql')),tokens(original.slice(226,248).join('\n')));
});
test('complete production SQL preserves every token and positional output column', () => {
  for (const [id, name] of Object.entries(names)) {
    assert.deepEqual(tokens(read(name)), tokens(read('99_证据/证据_' + id + '.sql').split('-- querySql')[1]));
    assert.equal(parse(read(name)).fields.length, id === '133055' ? 22 : 24);
  }
});
test('118141 fragments are exact excerpts including original per-field fallback', () => {
  assert.deepEqual(tokens(contractJoin()), tokens(original.slice(349, 360).join('\n')));
  assert.deepEqual(tokens(typeJoin()), tokens(original.slice(360, 381).join('\n')));
  assert.deepEqual(tokens(outputFields()), tokens([...original.slice(219, 221), original[286]].join('\n')));
});
test('source hashes and all README links resolve', () => {
  const manifest = JSON.parse(read('99_证据/证据索引.json'));
  for (const s of [...manifest.sources, manifest.consumer])
    assert.equal(createHash('sha256').update(read('99_证据/'+s.file)).digest('hex'), s.fileSha256, s.file);
  for (const [, target] of read('README.md').matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g))
    assert.ok(existsSync(join(root, target)), target);
});
test('wrong identity key, consumption partition and type-date mutations are observable', () => {
  for (const [sql, before, after] of [
    [contractJoin(), 's_ba.CONTRACT_CODE = info.Agt_Id', 's_ba.CONTRACT_CODE = info.Inr_Seri_No'],
    [contractJoin(), 'ODATA_N_OIS.O_CONTRACT_BASE_RATE', 'ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE'],
    [typeJoin(), 'c_ba.busi_date = info.Strt_Pric_Date', 'c_ba.busi_date = det.busi_date'],
  ]) {
    assert.ok(sql.includes(before));
    assert.notDeepEqual(tokens(sql), tokens(sql.replace(before, after)));
  }
});

// Synthetic rows only. SQLite verifies these examples, not Hive execution or production data.
function adapt(sql) {
  return scan(sql).map(t => t.text).join(' ')
    .replaceAll('! =', '!=').replaceAll('< =', '<=').replaceAll('> =', '>=')
    .replaceAll('< >', '<>');
}
function table(db, name, rows) {
  const keys = Object.keys(rows[0]);
  db.exec('CREATE TABLE ' + name + ' (' + keys.join(',') + ')');
  const statement = db.prepare('INSERT INTO ' + name + ' VALUES (' + keys.map(() => '?').join(',') + ')');
  for (const row of rows) statement.run(...keys.map(k => row[k] ?? null));
}
function fixture(options = {}) {
  const db = new DatabaseSync(':memory:');
  db.function('if', (condition, yes, no) => condition ? yes : no);
  db.exec("ATTACH DATABASE ':memory:' AS pdata_n");
  const start = '2026-09-10', today = options.day ?? start;
  table(db, 'info', [{
    Agt_Id: 'OIS1', Busi_Type: options.business ?? 'OPTION', Src_Contr_Type: 'NORMAL',
    Contr_Type_Cd: 'TYPE1', Marg_Agt_Id: '', Ddct_Ptrn: '', Init_Marg_Prop: 0,
    Base_Marg_Rate: 0, Strt_Pric_Date: start, Early_Term_Date: options.early ?? null,
    End_Pric_Date: '2026-09-30', Init_Nom_Prin: 3650000,
  }]);
  table(db, 'det', [{
    busi_date: today, Dyna_Nom_Prin: 3650000, fee_rate: 0, Inta: 0,
    Trd_Cms: 0, Trd_Cms_Cost: 0, Fnd_Cost: 0,
  }]);
  table(db, 's_sp', [{
    Spread_Calculation: options.spreadType ?? 'ANNUALIZED', Annualized_Spread: 0.006, Absolute_Spread: 0.006,
  }]);
  table(db, 'c_sp', [{Spread_Calculation: null, Annualized_Spread: null, Absolute_Spread: null}]);
  table(db, 'c_ba', [{
    BASE_CALCULATION: options.typeFallback ?? 'ABSOLUTE',
    BASE_AWARD_RATE: options.rateFallback ?? 0.01,
  }]);
  table(db, 'cc', [{capital_cost: 0}]);
  const contract = {
    Inr_Comp_No: 'OIS1', Agt_Id: 'TIT1', Calc_Type: 'ANNUALIZED',
    Base_Yield: 0.003, Adtnl_Rwd: options.reward ?? '', Adtnl_Rwd_Flag: 'N',
    src_tbl: 'ODATA_N_OIS.O_CONTRACT_BASE_RATE', Del_Flag: '0',
    ...(options.contract ?? {}),
  };
  table(db, 'pdata_n.T99_DERI_COMP_BASE_COEF_REF', [contract, ...(options.extra ?? [])]);
  return db;
}
function result(db) {
  const fields = outputFields();
  const income = canonical('02_原始当日收入.sql').replace(/,\s*$/, '');
  return db.prepare(adapt('SELECT ' + fields + income +
    ' FROM info CROSS JOIN det CROSS JOIN s_sp CROSS JOIN c_sp CROSS JOIN c_ba CROSS JOIN cc ' +
    contractJoin())).all();
}
function sample(options, callback) {
  const db = fixture(options);
  try { callback(result(db)); } finally { db.close(); }
}
for (const business of ['OPTION', 'TRS']) {
  for (const [spreadType, baseType, initial, subsequent] of [
    ['ANNUALIZED', 'ANNUALIZED', 90, 90],
    ['ANNUALIZED', 'ABSOLUTE', 11010, 60],
    ['ABSOLUTE', 'ANNUALIZED', 21930, 30],
    ['ABSOLUTE', 'ABSOLUTE', 32850, 0],
  ]) {
    test(business + ' income: ' + spreadType + ' spread / ' + baseType + ' base', () => {
      const options = {business, spreadType, contract: {Calc_Type: baseType}};
      sample(options, rows => assert.equal(rows[0].Curr_Prvs_Sales_Income, initial));
      sample({...options, day: '2026-09-22'}, rows => assert.equal(rows[0].Curr_Prvs_Sales_Income, subsequent));
    });
  }
}
test('fallback is per field; zero is present, not missing', () => {
  sample({contract: {Base_Yield: null}}, rows => assert.equal(rows[0].Annu_Base, 0.01));
  sample({contract: {Calc_Type: null, Base_Yield: 0}}, rows => {
    assert.equal(rows[0].Absl_Base, 0);
    assert.equal(rows[0].Curr_Prvs_Sales_Income, 60);
  });
});
test('blank type blocks fallback and produces no ordinary income branch', () => {
  sample({contract: {Calc_Type: ''}}, rows => {
    assert.equal(rows[0].Annu_Base, '');
    assert.equal(rows[0].Absl_Base, '');
    assert.equal(rows[0].Curr_Prvs_Sales_Income, null);
  });
});
test('extra reward is displayed even with flag N but is not added to income', () => {
  sample({reward: 5000}, rows => {
    assert.equal(rows[0].Adtnl_Rwd, 5000);
    assert.equal(rows[0].Curr_Prvs_Sales_Income, 90);
  });
});
test('contract parameters require identified key but match original contract number', () => {
  sample({contract: {Agt_Id: 'DIFFERENT_TIT_ID'}}, rows => assert.equal(rows[0].Annu_Base, 0.003));
  for (const contract of [
    {Agt_Id: ''}, {Del_Flag: '1'}, {src_tbl: 'ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE'},
  ]) sample({contract}, rows => assert.equal(rows[0].Absl_Base, 0.01));
});
test('annual income includes early termination date and stops thereafter', () => {
  sample({day: '2026-09-20', early: '2026-09-20'}, rows => assert.equal(rows[0].Curr_Prvs_Sales_Income, 90));
  sample({day: '2026-09-21', early: '2026-09-20'}, rows => assert.equal(rows[0].Curr_Prvs_Sales_Income, 0));
});
test('contract join does not choose latest parameter or enforce uniqueness', () => {
  const extra = {
    Inr_Comp_No: 'OIS1', Agt_Id: 'TIT2', Calc_Type: 'ANNUALIZED',
    Base_Yield: 0.004, Adtnl_Rwd: '', Adtnl_Rwd_Flag: 'N',
    src_tbl: 'ODATA_N_OIS.O_CONTRACT_BASE_RATE', Del_Flag: '0',
  };
  sample({extra: [extra]}, rows => {
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.Annu_Base).sort(), [0.003, 0.004]);
  });
});
test('type interval uses initial pricing date, includes endpoints and preserves overlaps', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.function('if', (condition, yes, no) => condition ? yes : no);
    db.function('date_add', (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10));
    db.function('datediff', (end, start) => (Date.parse(end) - Date.parse(start)) / 86400000);
    db.exec("ATTACH DATABASE ':memory:' AS pdata_n");
    const row = {
      Src_Comp_Type_Cd: 'TYPE1', Src_Comp_Type_Desc: '类型1', Calc_Type: 'ANNUALIZED',
      Base_Yield: 0.003, Bgng_Prcg_Date_Llmt: '2026-09-01', Bgng_Prcg_Date_Ulmt: '2026-09-15',
      src_tbl: 'ODATA_N_OIS.O_BUS_TYPE_BASE_RATE', Del_Flag: '0', Src_Dept_No: 'OTC',
    };
    table(db, 'pdata_n.T99_DERI_COMP_TYPE_BASE_COEF_REF', [
      row, {...row, Base_Yield: 0.004, Bgng_Prcg_Date_Llmt: '2026-09-16', Bgng_Prcg_Date_Ulmt: '2026-09-30'},
      {...row, Base_Yield: 0.005, Bgng_Prcg_Date_Llmt: '2026-09-15'},
      {...row, Base_Yield: 9, Src_Dept_No: 'OTHER'},
    ]);
    table(db, 'info', [
      {Contr_Type_Cd: 'TYPE1', Strt_Pric_Date: '2026-09-01'},
      {Contr_Type_Cd: 'TYPE1', Strt_Pric_Date: '2026-09-15'},
      {Contr_Type_Cd: 'TYPE1', Strt_Pric_Date: '2026-09-16'},
    ]);
    // Bounded adapter for the one Hive lateral date expansion; preserves the source expressions and ON.
    const adapted = adapt(typeJoin()).replace(
      /LATERAL VIEW posexplode \( split \( space \( datediff \( end_date , strt_date \) \) , ' ' \) \) y AS pos , val/i,
      'CROSS JOIN days y WHERE y.pos <= datediff(end_date, strt_date)',
    );
    assert.ok(!/posexplode/i.test(adapted));
    const rows = db.prepare('WITH RECURSIVE days(pos) AS (SELECT 0 UNION ALL SELECT pos+1 FROM days WHERE pos<31) ' +
      'SELECT info.Strt_Pric_Date, c_ba.BASE_AWARD_RATE FROM info ' + adapted +
      ' ORDER BY info.Strt_Pric_Date, c_ba.BASE_AWARD_RATE').all();
    assert.deepEqual(rows.map(r => Object.values(r)), [
      ['2026-09-01', 0.003], ['2026-09-15', 0.003], ['2026-09-15', 0.005], ['2026-09-16', 0.004],
    ]);
  } finally { db.close(); }
});

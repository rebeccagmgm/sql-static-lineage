import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root, render} from '../render.mjs';
import {parse} from './sql-shape.mjs';
import {cteBodies} from './option-stages.mjs';
import {inlineTrsSteps} from './trs-stages.mjs';

const original = parse(readFileSync(join(root, '06_原始SQL/86841.sql'), 'utf8'))
  .joins.find(j => j.alias === 'his_ini').body;
const steps = ['ranked_initial_positions', 'first_initial_positions',
  'initial_position_details', 'initial_position'];
const day = '2026-09-21';
const tables = {
  pos: ['odata_n_tit.d_pos_trs_leg_his_pos',
    ['busi_date','key_leg_id','underlying_ins_id','src_busi_date','wind_code','ins_sht_desc','Init_Price','Init_Quantity']],
  pool: ['odata_n_tit.r_cfg_instrument_pool_props',
    ['busi_date','KEY_POOL_ID','key_instrument_id','interotc_underlying_category']],
  ins: ['odata_n_tit.d_ref_instrument',
    ['busi_date','key_instrument_id','ins_family','currency','ins_lng_desc']],
  fut: ['odata_n_tit.d_ref_future_properties',
    ['busi_date','key_instrument_id','future_type']],
  dict: ['PDATA_N.REF_DW_CD_VAL', ['dw_cd_id','remark','dw_cd_val','dw_cd_val_desc']],
};
function fixture(kind) {
  const rows = {
    pos: [
      [day,'L1','I1','2026-01-01','W1','one',10,100],
      [day,'L1','I1','2026-02-01','W1-later','later',99,99],
      [day,'L1','I2','2026-03-01','W2','two',20,50],
      ['2026-09-20','L1','I1','2025-01-01','wrong','wrong',999,999],
    ],
    pool: [[day,'10000','I1','STOCK'],[day,'99999','I1','wrong']],
    ins: [[day,'I1','EQUITY','HKD','full1'],[day,'I2','FUTURE','USD','full2']],
    fut: [[day,'I2','INDEX']],
    dict: [['CD128','TITANS场外衍生品标的类型','EQUITY','股票'],
      ['CD128','TITANS场外衍生品标的类型','FUTURE','期货']],
  };
  if (kind.startsWith('duplicate-')) {
    const key = kind.slice('duplicate-'.length);
    rows[key].push([...rows[key][0]]);
  }
  if (kind === 'missing-dimensions') for (const key of ['pool','ins','fut','dict']) rows[key] = [];
  if (kind === 'null-quantity') rows.pos[0][7] = null;
  if (kind === 'empty-snapshot') rows.pos = [];
  if (kind === 'two-legs') rows.pos.push([day,'L2','I1','2026-04-01','W1','one',10,5]);
  return rows;
}
function setup(db, rows) {
  db.exec("ATTACH DATABASE ':memory:' AS odata_n_tit; ATTACH DATABASE ':memory:' AS PDATA_N");
  for (const name of ['collect_list','collect_set']) {
    db.aggregate(name, {start:'[]', step:(state, value) => {
      const list = JSON.parse(state);
      if (value !== null && (name === 'collect_list' || !list.includes(value))) list.push(value);
      return JSON.stringify(list);
    }});
  }
  db.function('concat_ws', (sep, values) => JSON.parse(values).join(sep));
  for (const [key, [table, columns]] of Object.entries(tables)) {
    db.exec('CREATE TABLE ' + table + ' (' + columns.join(',') + ')');
    const insert = db.prepare('INSERT INTO ' + table + ' VALUES (' + columns.map(() => '?').join(',') + ')');
    for (const row of rows[key]) insert.run(...row);
  }
}
// Spark collect_list/set have no defined ordering here: compare values with
// multiplicity, not incidental SQLite aggregation order. No live data is read.
function canonical(rows) {
  return rows.map(r => JSON.stringify(Object.values(r).map(v =>
    typeof v === 'string' ? v.split(';').sort() : v))).sort();
}
for (const kind of ['normal','duplicate-pool','duplicate-ins','duplicate-fut','duplicate-dict',
  'missing-dimensions','null-quantity','empty-snapshot','two-legs']) {
  test('02 TRS initial position original vs four steps: ' + kind, () => {
    const sql = render('02_普通互换'), bodies = cteBodies(sql);
    inlineTrsSteps(sql);
    const current = 'WITH ' + steps.map(n => n + ' AS (' + bodies.get(n) + ')').join(',\n') +
      '\nSELECT * FROM initial_position';
    const db = new DatabaseSync(':memory:');
    try {
      setup(db, fixture(kind));
      const run = s => db.prepare(s.replaceAll('$' + '{data_day_str}', day)).all();
      const result = run(current);
      assert.deepEqual(canonical(result), canonical(run(original)));
      assert.equal(result.length, kind === 'empty-snapshot' ? 0 : kind === 'two-legs' ? 2 : 1);
      if (result.length) {
        const first = result.find(r => r.key_leg_id === 'L1');
        assert.equal(first.Nom_Prin, kind.startsWith('duplicate-') ? 3000 :
          kind === 'null-quantity' ? 1000 : 2000);
        assert.ok(!first.wind_code.includes('later'), 'uses earliest per underlying, not latest');
        assert.ok(!first.wind_code.includes('wrong'), 'snapshot filter retained');
      }
    } finally { db.close(); }
  });
}
test('02 TRS reversal rejects altered selection, filters and formulas', () => {
  const sql = render('02_普通互换');
  for (const [before, after] of [
    ['where rk = 1', 'where rk = 2'],
    ['t.Init_Price as Init_Price', 't.Init_Price * 2 as Init_Price'],
    ['on sutd.dw_cd_val = d.ins_family', 'on sutd.dw_cd_val = d.ins_family\nwhere d.currency is not null'],
    ['FROM initial_position_details p', 'FROM initial_position_details p\nwhere p.Init_Quantity > 0'],
  ]) {
    assert.ok(sql.includes(before), 'mutation target exists');
    assert.throws(() => inlineTrsSteps(sql.replace(before, after)));
  }
});

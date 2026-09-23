import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root, render} from '../render.mjs';
import {parse} from './sql-shape.mjs';
import {cteBodies} from './option-stages.mjs';
import {inlineFastSteps} from './fast-stages.mjs';

const original = parse(readFileSync(join(root, '06_原始SQL/220650.sql'), 'utf8'));
const oldInitial = original.joins.find(j => j.alias === 'dy').body;
const oldDaily = original.joins.find(j => j.alias === 'np').body;
const steps = ['ranked_initial_positions','first_initial_positions','initial_position_details','initial_position','daily_position'];
const day = '2026-09-21';
const tables = {
  pos: ['odata_n_tit.d_pos_fast_trs_leg_his_pos',
    ['busi_date','position_type','key_instrument_id','wind_code','underlying_ins_id',
      'src_busi_date','ins_sht_desc','ins_family','currency','dynamic_notional','notional']],
  ins: ['odata_n_tit.d_ref_instrument',
    ['busi_date','key_instrument_id','wind_code','ins_lng_desc','currency','ins_family']],
  fut: ['odata_n_tit.d_ref_future_properties',['busi_date','key_instrument_id','future_type']],
  dict: ['PDATA_N.REF_DW_CD_VAL',['dw_cd_id','remark','dw_cd_val','dw_cd_val_desc']],
};
function fixture(kind) {
  const rows = {
    pos: [
      [day,'EOD_POSITION','T1','W1','U1','2026-01-01','one','EQUITY','HKD',100,999],
      [day,'EOD_POSITION','T1','W2','U2','2026-03-01','two','EQUITY','HKD',200,999],
      [day,'EOD_POSITION','T1','W1','U1',day,'one-current','EQUITY','HKD',80,999],
      [day,'EOD_POSITION','T1','W2','U2',day,'two-current','EQUITY','HKD',150,999],
      [day,'OTHER','T1','W1','U1','2020-01-01','wrong-type','EQUITY','HKD',9999,9999],
      ['2026-09-20','EOD_POSITION','T1','W1','U1','2020-01-01','wrong-snapshot','EQUITY','HKD',9999,9999],
    ],
    ins: [[day,'I1','W1','full1','HKD','EQUITY'],[day,'I2','W2','full2','HKD','EQUITY']],
    fut: [[day,'I1','F1']],
    dict: [['CD128','TITANS场外衍生品标的类型','EQUITY','股票'],
      ['CD128','TITANS场外衍生品标的类型','FUTURE','期货']],
  };
  if (['duplicate-ins','duplicate-fut','duplicate-dict'].includes(kind)) {
    const key = kind.slice(10);
    rows[key].push([...rows[key][0]]);
  }
  if (kind === 'duplicate-current') rows.pos.push([...rows.pos[2]]);
  if (kind === 'no-today') rows.pos = rows.pos.filter(r => r[5] !== day);
  if (kind === 'no-position') rows.pos = [];
  if (kind === 'missing-instrument') rows.ins = [];
  if (kind === 'null-amounts') for (const r of rows.pos) r[9] = null;
  if (kind === 'zero-amounts') for (const r of rows.pos) r[9] = 0;
  if (kind === 'source-differences') {
    rows.ins[0][4] = 'USD'; rows.ins[0][5] = 'FUTURE';
  }
  if (kind === 'changed-underlying-id') {
    rows.pos.push([day,'EOD_POSITION','T1','W1','U99','2026-02-01','same-wind-new-id','EQUITY','HKD',999,999]);
  }
  if (kind === 'second-instrument') {
    rows.pos.push([day,'EOD_POSITION','T2','W1','U1',day,'two-contract','EQUITY','HKD',7,999]);
  }
  return rows;
}
function setup(db, rows) {
  db.exec("ATTACH DATABASE ':memory:' AS odata_n_tit; ATTACH DATABASE ':memory:' AS PDATA_N");
  db.function('substring', (s, start, n) => s === null ? null : String(s).slice(start-1,start-1+n));
  for (const name of ['collect_list','collect_set']) {
    db.aggregate(name,{start:'[]',step:(state,value) => {
      const list = JSON.parse(state);
      if (value !== null && (name === 'collect_list' || !list.includes(value))) list.push(value);
      return JSON.stringify(list);
    }});
  }
  db.function('concat_ws',(sep,values) => JSON.parse(values).join(sep));
  for (const [key,[table,columns]] of Object.entries(tables)) {
    db.exec('CREATE TABLE ' + table + ' (' + columns.join(',') + ')');
    const insert = db.prepare('INSERT INTO ' + table + ' VALUES (' + columns.map(() => '?').join(',') + ')');
    for (const row of rows[key]) insert.run(...row);
  }
}
// Aggregation order is not specified by the source SQL. Preserve duplicate
// multiplicity, but disregard incidental ordering of each display list.
function canonical(rows) {
  return rows.map(r => JSON.stringify(Object.values(r).map(v =>
    typeof v === 'string' ? v.split(/[;,]/).sort() : v))).sort();
}
for (const kind of ['normal','duplicate-ins','duplicate-fut','duplicate-dict','duplicate-current',
  'no-today','no-position','missing-instrument','null-amounts','zero-amounts',
  'source-differences','changed-underlying-id','second-instrument']) {
  test('04 FAST frozen original vs reading steps: ' + kind, () => {
    const sql = render('04_指定FAST_TRS'), bodies = cteBodies(sql);
    inlineFastSteps(sql);
    const current = 'WITH ' + steps.map(n => n + ' AS (' + bodies.get(n) + ')').join(',\n');
    const baseline = 'WITH initial_position AS (' + oldInitial + '), daily_position AS (' + oldDaily + ')';
    const amounts = fields => '\nSELECT ' + fields.slice(24,28).join(',') +
      " FROM (SELECT 'T1' AS key_instrument_id) trade" +
      ' LEFT JOIN initial_position dy ON dy.key_instrument_id=trade.key_instrument_id' +
      ' LEFT JOIN daily_position np ON np.key_instrument_id=trade.key_instrument_id';
    const db = new DatabaseSync(':memory:');
    try {
      setup(db,fixture(kind));
      const run = s => db.prepare(s.replaceAll('$'+'{data_day_str}',day)).all();
      for (const result of ['initial_position','daily_position']) {
        assert.deepEqual(canonical(run(current+' SELECT * FROM '+result)),
          canonical(run(baseline+' SELECT * FROM '+result)), result);
      }
      const actual = run(current+amounts(parse(sql).fields));
      assert.deepEqual(actual, run(baseline+amounts(original.fields)), 'four amount outputs including NULL/string defaults');
      const initial = run(current+' SELECT * FROM initial_position').find(r => r.key_instrument_id==='T1');
      const values = Object.values(actual[0]);
      const initialExpected = ['no-position','null-amounts'].includes(kind) ? null :
        kind === 'zero-amounts' ? 0 : kind === 'duplicate-dict' ? 600 :
        ['duplicate-ins','duplicate-fut'].includes(kind) ? 400 : 300;
      assert.equal(values[0], '1');
      assert.equal(values[1], initialExpected, 'earliest dynamic_notional, not notional');
      assert.equal(values[2], ['no-position','no-today','null-amounts'].includes(kind) ? '0' :
        kind==='zero-amounts' ? 0 : kind==='duplicate-current' ? 310 : 230);
      assert.equal(values[3], '0.0');
      if (kind === 'source-differences') {
        assert.equal(initial.Undrl_Curr, 'HKD', 'display currency is from positions');
        assert.deepEqual(initial.Undrl_Type.split(',').sort(), ['HK_STOCK','US_STOCK']);
        assert.equal(initial.Src_Undrl_Type, 'EQUITY');
        assert.ok(initial.Src_Undrl_Type_Desc.includes('期货'), 'description comes from instrument family');
      }
      if (kind === 'missing-instrument') assert.equal(initial.Undrl_Type,'-');
      if (kind === 'changed-underlying-id') assert.ok(!initial.Undrl_Ins_Id.includes('U99'), 'rank partitions by WIND, not underlying id');
    } finally { db.close(); }
  });
}
test('04 FAST reversal rejects changed selection, filtering and amount source', () => {
  const sql = render('04_指定FAST_TRS');
  for (const [before,after] of [
    ['where rk = 1','where rk = 2'],
    ['dy.dynamic_notional as dynamic_notional','dy.notional as dynamic_notional'],
    ['on sutd.dw_cd_val = d.ins_family','on sutd.dw_cd_val = d.ins_family\nwhere d.currency is not null'],
    ['FROM initial_position_details p','FROM initial_position_details p\nwhere p.dynamic_notional > 0'],
  ]) {
    assert.ok(sql.includes(before));
    assert.throws(() => inlineFastSteps(sql.replace(before,after)));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeValues} from './partition-values.mjs';
test('business values preserved even when numeric',()=>assert.deepEqual(summarizeValues('src_tbl',['B','A','B']).values,['A','B']));
test('daily date values summarized',()=>assert.equal(summarizeValues('busi_date',['20260101','20260102','20260103']).values,null));
test('monthly dates retained',()=>assert.equal(summarizeValues('busidate',['20260131','20260228','20260331']).values.length,3));
test('sparse or special dates not silently discarded',()=>{
  assert.equal(summarizeValues('busidate',['20260101','20260108','20260115']).values.length,3);
  assert.equal(summarizeValues('busidate',['20260101','20260102','ALL']).values.length,3);
});

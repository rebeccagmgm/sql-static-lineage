import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionBusinessErrorCode,runPartitionTable} from './partition-errors.mjs';

const message='查询异常Cannot invoke "String.startsWith(String)" because "typeName" is null';
test('only the verified business response is quarantinable',()=>{
  assert.equal(partitionBusinessErrorCode({code:1,msg:message}),'SOURCE_METADATA_TYPE_MISSING');
  for(const body of [{code:403,msg:message},{code:1,msg:'权限不足'},{code:1,msg:'typeName is null'},{code:1,msg:message+' other error'}])
    assert.equal(partitionBusinessErrorCode(body),'PORTAL_BUSINESS_ERROR');
});
test('missing table is recorded and next table proceeds',async()=>{
  const results=[],events=[];
  for(const name of ['missing','next'])results.push(await runPartitionTable(async()=>{
    if(name==='missing')throw Error('SOURCE_METADATA_TYPE_MISSING');return 'CAPTURED';
  },()=>events.push(name)));
  assert.deepEqual(results,['BLOCKED','CAPTURED']);assert.deepEqual(events,['missing']);
});
test('permissions, rate limits, unknown errors and recording failures still stop',async()=>{
  for(const code of ['HTTP_401','HTTP_403','HTTP_429','PORTAL_BUSINESS_ERROR','INVALID_PARTITION_VALUES','USER_STOP'])
    await assert.rejects(runPartitionTable(()=>{throw Error(code);},()=>assert.fail('must not quarantine')), {message:code});
  await assert.rejects(runPartitionTable(()=>{throw Error('SOURCE_METADATA_TYPE_MISSING');},()=>{throw Error('SQLITE_ERROR');}),{message:'SQLITE_ERROR'});
});

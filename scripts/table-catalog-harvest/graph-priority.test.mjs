import test from 'node:test';
import assert from 'node:assert/strict';
import {matchGraphTables} from './graph-priority.mjs';
test('graph priority requires confirmed unique physical identity',()=>{
  const row=(platform='hive',dataSource='a',identityStatus='CONFIRMED')=>({id:'n',detail:JSON.stringify({platform,dataSource,identityStatus,qualifiedName:'db.t'})});
  const assets=[{guid:'1',databaseType:'HIVE',qualifiedName:'db.t@a'},{guid:'2',databaseType:'HIVE',qualifiedName:'db.t@b'}];
  assert.equal(matchGraphTables([row()],assets)[0].guid,'1');
  assert.equal(matchGraphTables([row('oracle')],assets)[0].status,'NOT_IN_CATALOG');
  assert.equal(matchGraphTables([row('hive','c')],assets)[0].status,'NOT_IN_CATALOG');
  assert.equal(matchGraphTables([row('hive','a','CANDIDATE_DATASET')],assets)[0].status,'UNCONFIRMED_IDENTITY');
  assert.equal(matchGraphTables([row()],[...assets,assets[0]])[0].status,'AMBIGUOUS');
});

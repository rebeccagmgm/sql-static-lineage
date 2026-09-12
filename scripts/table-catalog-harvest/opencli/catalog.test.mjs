import test from 'node:test';
import assert from 'node:assert/strict';
import {queryFields,mapPage} from './catalog-core.mjs';
const row={guid:'a',metadataType:'003000',parentQualifiedName:'db@source',classificationList:['分类_目录_分支']};
const page = records => ({records,totalResultNum:records.length,pageNo:1,pageSize:20});
test('window, physical database identity, and defaults',()=>{
  assert.throws(()=>queryFields({page:101,'page-size':100}),/WINDOW/);
  assert.throws(()=>queryFields({database:'db'}),/QUALIFIED/);
  assert.equal(queryFields().tempShow,0);assert.equal(queryFields().status,1);
});
test('reject foreign database and taxonomy; retain valid paths',()=>{
  assert.throws(()=>mapPage(page([row]),queryFields({database:'db@other'})),/SCOPE/);
  assert.throws(()=>mapPage(page([row]),queryFields({classification:'其他'})),/SCOPE/);
  assert.deepEqual(mapPage(page([row]),queryFields({classification:'目录'})).records[0].classifications,row.classificationList);
});
test('reject duplicate and truncated responses, keep empty totals',()=>{
  assert.throws(()=>mapPage(page([row,row]),queryFields()),/DUPLICATE/);
  assert.throws(()=>mapPage({...page([]),totalResultNum:5},queryFields()),/LENGTH/);
  assert.equal(mapPage(page([]),queryFields()).evidenceStatus,'EMPTY_RESULT');
});
test('virtual directory membership does not fabricate tags',()=>{
  const fields={...queryFields({classification:'虚拟'}),extraDatabaseId:'db@source'};
  assert.deepEqual(mapPage(page([{...row,classificationList:[]}]),fields).records[0].classifications,[]);
});

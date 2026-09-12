import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, validatePage } from './store.mjs';

const row=(guid,tag='分类_体系_业务')=>({guid,name:'table_'+guid,qualifiedName:'db.table_'+guid,metadataType:'003000',classificationList:[tag]});
const page=(records,totalResultNum,pageNo=1,pageSize=2)=>({records,totalResultNum,pageNo,pageSize});
const add=(s,id='g')=>{s.addGroup({id,scope:id,name:id,kind:'ROOT',query:{classifications:['分类_体系']},priority:1});return s.getGroup(id);};

test('window guard and truncated response fail closed',()=>{
  assert.throws(()=>validatePage(page([],10001,101,100),101,100),/RESULT_WINDOW/);
  assert.throws(()=>validatePage(page([row('a')],3),1,2),/PAGE_LENGTH/);
});
test('cross-page duplicates rollback the entire page and retain resume position',()=>{
  const s=new Store(':memory:',{});let g=add(s);
  s.savePage(g,page([row('a'),row('b')],3),1,2);g=s.getGroup('g');
  assert.throws(()=>s.savePage(g,page([row('b')],3,2),2,2),/DUPLICATE_ACROSS/);
  assert.equal(s.getGroup('g').next_page,2);assert.equal(s.summary().uniqueTables,2);
  s.savePage(g,page([row('c')],3,2),2,2);
  s.verifyGroup(s.getGroup('g'),page([row('a'),row('b')],3),2);
  assert.equal(s.getGroup('g').state,'COMPLETE');s.close();
});
test('union deduplicates identity while retaining multiple source memberships',()=>{
  const s=new Store(':memory:',{});
  s.savePage(add(s,'g1'),page([row('a')],1),1,2);
  s.savePage(add(s,'g2'),page([row('a')],1),1,2);
  assert.equal(s.summary().uniqueTables,1);
  assert.equal(s.db.prepare('SELECT count(*) n FROM table_sources').get().n,2);s.close();
});
test('wrong taxonomy and changed source totals never become complete',()=>{
  const s=new Store(':memory:',{});const g=add(s);
  assert.throws(()=>s.savePage(g,page([row('a','分类_其他')],1),1,2),/SCOPE_MISMATCH/);
  assert.equal(s.summary().uniqueTables,0);
  s.savePage(g,page([row('a')],1),1,2);
  assert.throws(()=>s.verifyGroup(s.getGroup('g'),page([row('a'),row('b')],2),2),/FIRST_PAGE_OR_TOTAL/);s.close();
});
test('virtual membership does not fabricate a classification path',()=>{
  const s=new Store(':memory:',{});s.addGroup({id:'v',scope:'v',name:'v',kind:'ROOT',priority:1,
    query:{classifications:['分类_虚拟'],extraDatabaseId:'observed-database'}});
  s.savePage(s.getGroup('v'),page([row('a','分级_2')],1),1,2);
  assert.equal(s.db.prepare("SELECT count(*) n FROM observed_classifications WHERE category='分类'").get().n,0);s.close();
});
test('database filter validates physical parent including source suffix',()=>{
  const s=new Store(':memory:',{});s.addGroup({id:'db',scope:'platform',name:'db',kind:'LEAF',priority:1,
    query:{dataBaseIds:['db@source1']}});
  assert.throws(()=>s.savePage(s.getGroup('db'),page([{...row('a'),qualifiedName:'db.t@source2'}],1),1,2),/DATABASE_SCOPE_MISMATCH/);
  s.savePage(s.getGroup('db'),page([{...row('a'),qualifiedName:'db.t@source1'}],1),1,2);
  assert.equal(s.summary().uniqueTables,1);s.close();
});

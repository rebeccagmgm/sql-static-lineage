import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {root, expand, render} from './render.mjs';
import {scan, parse} from '../01_合约主信息/sql/checks/sql-shape.mjs';

const original = readFileSync(join(root,'../99_证据/105743-query.sql'),'utf8');
const values = sql => scan(sql).map(t => /^[A-Za-z_]/.test(t.text) ? t.text.toLowerCase() : t.text);
function statements(sql) {
  const result=[]; let start=0;
  for(const t of scan(sql)) if(t.text===';' && t.depth===0) {
    const part=sql.slice(start,t.end); if(scan(part).length) result.push(part); start=t.end;
  }
  assert.equal(scan(sql.slice(start)).length,0,'all statements terminated');
  return result;
}
const writes=sql=>statements(sql).filter(s=>scan(s).some(t=>t.depth===0&&t.text.toLowerCase()==='insert'));

// Reverse only the named inputs introduced here. Compare all original tokens,
// including both writes and both sets of Hive settings, without simplifying SQL.
function flatten(sql) {
  let total=0;
  const result=statements(sql).map(statement=>{
    const ts=scan(statement), bodies=new Map();
    const withToken=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='with');
    if(!withToken)return statement;
    const insert=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='insert');
    for(let i=0;i<ts.length-2;i++) {
      if(ts[i].start>=insert.start)break;
      if(ts[i].depth!==0||ts[i+1].text.toLowerCase()!=='as'||ts[i+2].text!=='(')continue;
      const close=ts.slice(i+3).find(t=>t.text===')'&&t.depth===0);
      const name=ts[i].text.toLowerCase(); assert.ok(!bodies.has(name));
      bodies.set(name,statement.slice(ts[i+2].end,close.start));
    }
    const visited=new Set();
    function inline(text,active=[]) {
      const tokens=scan(text), edits=[];
      for(let i=0;i<tokens.length-1;i++) {
        if(!['from','join'].includes(tokens[i].text.toLowerCase()))continue;
        const next=tokens[i+1],name=next.text.toLowerCase(); if(!bodies.has(name))continue;
        assert.ok(!active.includes(name));visited.add(name);
        edits.push({start:next.start,end:next.end,text:'('+inline(bodies.get(name),[...active,name])+')'});
      }
      for(const edit of edits.reverse())text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
      return text;
    }
    const output=statement.slice(0,withToken.start)+inline(statement.slice(insert.start));
    assert.equal(visited.size,bodies.size,'no unused CTEs');total+=bodies.size;
    return output;
  }).join('\n');
  assert.equal(total,14,'4 inputs before intermediate write; 10 before final write');
  return result;
}
test('105743: frozen source and both full writes are unchanged',()=>{
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '4f41d3eefca10d8b23da323ab612ef876fdf087e0c37cabee9e0ec4bb54e78d7');
  const sql=render();
  assert.equal(writes(sql).length,2);
  assert.deepEqual(writes(sql).map(s=>parse(s).fields.length),[32,59]);
  assert.deepEqual(values(flatten(sql)),values(original));
  assert.doesNotMatch(sql,/^\s*-- @include /m);
});
test('105743: changes in precedence, source identity and filters are detected',()=>{
  const sql=render();
  for(const [before,after] of [
    ['coalesce(ci.Allo_Prop_1, cpi.Allo_Prop_1)','coalesce(cpi.Allo_Prop_1, ci.Allo_Prop_1)'],
    ["info.Book_Bel_Dept = 'OTC'","info.Book_Bel_Dept = 'OTC_HK'"],
    ['tit.key_otc_trade_id = info.Inr_Seri_No','tit.key_otc_trade_id = info.Agt_Id'],
    ["and seq = '1'","and seq = '2'"],
    ['cast(prin_prtc_prop as double) < 1','cast(prin_prtc_prop as double) <= 1'],
  ]) {
    assert.ok(sql.includes(before));
    assert.notDeepEqual(values(flatten(sql.replace(before,after))),values(original),before);
  }
});
test('105743: include safety and untouched date placeholders',()=>{
  assert.throws(()=>expand('../x.sql'),/flat SQL/);
  assert.throws(()=>expand('x.sql',()=>''),/empty SQL/);
  assert.throws(()=>expand('x.sql',()=> '-- @include x.sql'),/Circular/);
  assert.equal(expand('x.sql',()=> "select '${data_day_str}'"),"select '${data_day_str}'");
});
test('105743: generated copy matches modules and reading links resolve',()=>{
  assert.equal(readFileSync(join(root,'完整SQL.sql'),'utf8'),render(),'regenerate after module edits');
  const readme=readFileSync(join(root,'README.md'),'utf8');
  const links=[...readme.matchAll(/\[[^\]\r\n]+\]\(([^)]+)\)/g)];
  assert.ok(links.length>=10);
  for(const [,target] of links)assert.ok(existsSync(join(root,target)),target);
});

// In-memory illustrative fixtures, NOT production data or a Hive engine test.
// Three explicit adaptations: Hive numeric comparison/coercion, SPLIT array
// access, and a controlled calendar stub. No assumption about live UDF/calendar.
const day='2026-09-21';
function sqliteQuery(statement) {
  const ts=scan(statement), w=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='with');
  const ins=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='insert');
  const sel=ts.find(t=>t.depth===0&&t.text.toLowerCase()==='select');
  let sql=(w?statement.slice(w.start,ins.start):'')+statement.slice(sel.start);
  sql=scan(sql).map(t=>t.text).join(' ').replaceAll('! =','!=').replaceAll('< =','<=');
  sql=sql.replace(/A\s*\.\s*seq\s*=\s*'([123])'/gi,'A.seq = $1')
    .replace(/then A\s*\.\s*Allocation_Proportion else '0'/gi,'then A.Allocation_Proportion else 0')
    .replace(/split\s*\(\s*dn\s*,\s*'='\s*\)\s*\[\s*1\s*\]/gi,'dn_name(dn)')
    .replace(/default\s*\.\s*pretradedate/gi,'pretradedate');
  return sql.replaceAll('${data_day_str}',day).replaceAll('${data_today}',day).replaceAll('${filename}','fixture');
}
const tables={
  customer:['odata_n_ois.o_counterparty_introduction','client_id introduction_department customer_manager allocation_proportion is_deleted busi_date'],
  contract:['odata_n_ois.o_contract_introduction','contract_code introduction_department customer_manager allocation_proportion is_deleted busi_date'],
  hk:['odata_n_oom.g_hk_counterparty_introduction','client_id department introductor allocation_proportion seq operator busi_date'],
  employee:['pdata_n.t98_org_emp_base_info','emp_id oa_user_id emp_name emp_stat_cd emp_stat_desc bel_inr_org_id_len4 bel_inr_org_name busi_date'],
  org:['pdata_n.t04_oas_inr_org','dept_no unif_org_id dn inr_org_lvl src_tbl dept_flag busi_date'],
  division:['pdata_n.t98_org_brch_div_info','inr_org_id inr_org_name brch_bel_div_org_id brch_bel_div_org_name busi_date'],
  sale:['pdata_n.t98_otc_deri_comp_sale_info','agt_id cutp_pty_id inr_seri_no book_bel_dept busi_date'],
  voucher:['pdata_news_n.t02_fin_float_income_vchr_info','comp_no prin_prtc_prop deal_cutp_no src_id grp_id busi_date'],
  cp:['odata_n_ois.o_otc_derivative_counterparty','client_id operator introduction_operator delete_flag busi_date'],
  rate:['odata_n_ois.o_contract_base_rate','contract_code operator_name introduction_operator_name is_deleted busi_date'],
  internal:['odata_n_ois.g_inr_contract_base_rate','contract_code operator_name introduction_operator_name is_deleted busi_date'],
  tit:['odata_n_tit.d_trd_otc_contr_props','key_otc_trade_id property_name property_value busi_date'],
};
function fixture(kind) {
  const rows={
    customer:[['C1','11','CA','0.6','N',day],['C1','12','CB','0.4','N',day]],
    contract:[['A1','1','KA','0.7','N',day]],hk:[],
    employee:['CA','CB','KA','KB','CO','CI','SO','SI','IO','II','TO','TC','H1','H2'].map((id,i)=>
      ['E'+id,id,'Name'+id,'ACTIVE','在职','9001','员工部门',day]),
    org:['0001','0011','0012'].map(d=>[d,'X'+d,'CN=Dept'+d,1,'ODATA_N_OAS.P_GF_DEPARTMENT','1','2000-01-01']),
    division:['0001','0011','0012'].map(d=>[d,'Dept'+d,'8000','Division8000',day]),
    sale:[['A1','C1','I1','OTC',day]],voucher:[],
    cp:[['C1','CO','CI','0',day]],rate:[['A1','SO','SI','N',day]],internal:[['A1','IO','II','N',day]],
    tit:[[ 'I1','operator','TO',day],['I1','customerManager','TC',day]],
  };
  if(kind==='customer-fallback')rows.contract=[];
  if(kind==='null-name-mixed-source'||kind==='blank-name-no-fallback') {
    rows.employee=rows.employee.filter(r=>r[1]!=='KA');
    if(kind==='blank-name-no-fallback')rows.contract.push(['A1','2','KB','0.3','N',day]);
  }
  if(kind==='top-three') {
    rows.contract=[];
    rows.customer=['CA','CB','CC','CD'].map((id,i)=>['C1','11',id,String((4-i)/10),'N',day]);
  }
  if(kind==='tie-order') {rows.contract=[];rows.customer.reverse().forEach(r=>r[3]='0.5');}
  if(kind==='source-collision') {
    rows.contract=[];rows.customer=[['C1','9000','A0','0.4','N',day]];
    rows.hk=[['C1','1000','Z0','0.9','2','UNUSED',day]];
  }
  if(kind==='hongkong-source-seq') {
    rows.contract=[];rows.customer=[];rows.cp=[];rows.sale[0][3]='OTC_HK';
    rows.hk=[['C1','11','H1','0.2','1','UNUSED',day],['C1','12','H2','0.8','2','UNUSED',day]];
  }
  if(kind==='hongkong-internal')rows.sale[0][3]='OTC_HK';
  if(kind==='operator-null-and-blank'){rows.rate[0][1]=null;rows.rate[0][2]='';}
  if(kind==='unmatched-operator')rows.rate[0][1]='UNKNOWN';
  if(kind==='duplicate-parameters')rows.rate.push(['A1','CO','SI','N',day],[...rows.rate[0]]);
  if(kind.startsWith('special-')) {
    rows.sale[0][1]='DEV1100100652';rows.contract=[];rows.rate=[];
    rows.voucher=[['A1',kind==='special-protected'?'1':'0.5',kind==='special-null-key'?null:'C1','OIS','01',day]];
    if(kind==='special-null-key')rows.customer.push(['DEV1100100652','99','ORIGINAL','1','N',day]);
  }
  if(kind==='tit-max')rows.tit.push(['I1','operator','ZZ',day],['A1','customerManager','WRONG_KEY',day]);
  if(kind==='missing-org')rows.org=[];
  if(kind==='employee-empty-id')rows.employee.find(r=>r[1]==='KA')[0]='';
  if(kind==='employee-null-id')rows.employee.find(r=>r[1]==='KA')[0]=null;
  if(kind==='filters') {
    rows.contract[0][4]='Y';rows.customer.forEach(r=>r[5]='2000-01-01');
    rows.cp[0][3]='1';rows.rate[0][3]='Y';rows.internal[0][3]='Y';
    rows.tit.forEach(r=>r[3]='2000-01-01');
  }
  if(kind==='outside-department')rows.sale[0][3]='OTHER';
  return rows;
}
function setup(db,rows) {
  for(const schema of new Set(Object.values(tables).map(([name])=>name.split('.')[0])))
    db.exec("ATTACH DATABASE ':memory:' AS "+schema);
  db.function('if',(cond,a,b)=>cond?a:b);
  db.function('lpad',(value,n,pad)=>value===null?null:String(value).padStart(n,pad).slice(0,n));
  db.function('dn_name',s=>s===null?null:(s.split('=')[1]??null));
  db.function('date_add',(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10));
  db.function('pretradedate',(s,n)=>{assert.equal(s,'2026-09-22');assert.equal(n,1);return day;});
  for(const [key,[name,columnText]] of Object.entries(tables)) {
    const columns=columnText.split(' ');
    db.exec('CREATE TABLE '+name+' ('+columns.map(c=>c+' '+(c==='inr_org_lvl'?'INTEGER':'TEXT')).join(',')+')');
    const insert=db.prepare('INSERT INTO '+name+' VALUES ('+columns.map(()=>'?').join(',')+')');
    for(const row of rows[key])insert.run(...row);
  }
}
const bag=rs=>rs.map(r=>JSON.stringify(Object.values(r))).sort();
test('105743 README contract A1: introduction changes, independent roles stay unchanged',()=>{
  for(const hasContractIntroduction of [true,false]) {
    const rows=fixture('baseline');
    rows.contract=hasContractIntroduction?[['A1','1','KA','1.0','N',day]]:[];
    const names={CA:'张三',CB:'李四',KA:'王五',SO:'赵六',SI:'周七'};
    rows.employee=rows.employee.map(row=>row.map((value,i)=>i===2?(names[row[1]]??value):value));
    const db=new DatabaseSync(':memory:');
    try {
      setup(db,rows);
      const run=sql=>{
        const [first,second]=writes(sql).map(sqliteQuery);
        db.exec('DROP TABLE IF EXISTS otc_div_temp');
        db.exec('CREATE TABLE otc_div_temp AS '+first);
        return {intermediate:db.prepare('SELECT * FROM otc_div_temp').all(),final:db.prepare(second).all()};
      };
      const expected=run(original),actual=run(render());
      assert.deepEqual(bag(actual.intermediate),bag(expected.intermediate));
      assert.deepEqual(bag(actual.final),bag(expected.final));
      // The example depends on real zero values, not NULL/blank coerced to zero by JavaScript.
      for(const record of [...actual.intermediate,...actual.final]) {
        for(const slot of [1,2,3]) {
          assert.notEqual(record['Allo_Prop_'+slot],null);
          assert.notEqual(record['Allo_Prop_'+slot],'');
        }
      }
      assert.equal(actual.intermediate.length,hasContractIntroduction?2:1);
      const customer=actual.intermediate.find(r=>r.client_id==='C1');
      assert.deepEqual([customer.Contract_Code,customer.Cust_Mngr_Name_1,Number(customer.Allo_Prop_1),
        customer.Cust_Mngr_Name_2,Number(customer.Allo_Prop_2),customer.Cust_Mngr_Name_3,Number(customer.Allo_Prop_3)],
        ['','张三',0.6,'李四',0.4,'',0]);
      if(hasContractIntroduction) {
        const contract=actual.intermediate.find(r=>r.Contract_Code==='A1');
        assert.deepEqual([contract.client_id,contract.Cust_Mngr_Name_1,Number(contract.Allo_Prop_1),
          contract.Cust_Mngr_Name_2,Number(contract.Allo_Prop_2),contract.Cust_Mngr_Name_3,Number(contract.Allo_Prop_3)],
          ['','王五',1,'',0,'',0]);
      }
      assert.equal(actual.final.length,1);
      const r=actual.final[0];
      assert.deepEqual([r.Agt_Id,r.Pty_Id],['A1','C1']);
      assert.deepEqual([r.Cust_Mngr_User_Id_1,r.Cust_Mngr_Name_1,r.Inr_Org_Id_1,Number(r.Allo_Prop_1),
        r.Cust_Mngr_User_Id_2,r.Cust_Mngr_Name_2,r.Inr_Org_Id_2,Number(r.Allo_Prop_2)],
        hasContractIntroduction?['KA','王五','0001',1,'','','',0]:['CA','张三','0011',0.6,'CB','李四','0012',0.4]);
      assert.deepEqual([r.Cust_Mngr_User_Id_3,Number(r.Allo_Prop_3)],['',0]);
      assert.deepEqual([r.Main_Oper_User_Id,r.Main_Oper_Name,r.Intro_Oper_User_Id,r.Intro_Oper_Name,
        r.Inr_Main_Oper_User_Id,r.Inr_Intro_Oper_User_Id,r.Tit_Oper_User_Id,r.Tit_Cust_Mngr_User_Id],
        ['SO','赵六','SI','周七','IO','II','TO','TC']);
    } finally {db.close();}
  }
});
const cases=['baseline','customer-fallback','null-name-mixed-source','blank-name-no-fallback','top-three',
  'tie-order','source-collision','hongkong-source-seq','hongkong-internal','operator-null-and-blank',
  'unmatched-operator','duplicate-parameters','special-switch','special-protected','special-null-key',
  'tit-max','missing-org','employee-empty-id','employee-null-id','filters','outside-department'];
for(const kind of cases)test('105743 synthetic two-write chain: '+kind,()=>{
  const db=new DatabaseSync(':memory:');
  try {
    setup(db,fixture(kind));
    const run=sql=>{
      const [first,second]=writes(sql).map(sqliteQuery);
      db.exec('DROP TABLE IF EXISTS otc_div_temp');
      db.exec('CREATE TABLE otc_div_temp AS '+first);
      return {intermediate:db.prepare('SELECT * FROM otc_div_temp').all(),final:db.prepare(second).all()};
    };
    const expected=run(original),actual=run(render());
    assert.deepEqual(bag(actual.intermediate),bag(expected.intermediate),'all 32 intermediate values and multiplicity');
    assert.deepEqual(bag(actual.final),bag(expected.final),'all 59 final values and multiplicity');
    if(kind==='outside-department'){assert.equal(actual.final.length,0);return;}
    assert.equal(actual.final.length,kind==='duplicate-parameters'?2:1);
    const r=actual.final[0];
    if(kind==='baseline') {
      assert.equal(r.Cust_Mngr_User_Id_1,'KA');assert.equal(Number(r.Allo_Prop_1),0.7);
      assert.equal(r.Cust_Mngr_User_Id_2,'');assert.equal(Number(r.Allo_Prop_2),0);
      assert.equal(r.Main_Oper_User_Id,'SO');assert.equal(r.Inr_Main_Oper_User_Id,'IO');assert.equal(r.Tit_Oper_User_Id,'TO');
      assert.equal(r.Inr_Org_Name_1,'Dept0001','OA org is not filtered to the processing date');
    }
    if(kind==='customer-fallback'){assert.equal(r.Cust_Mngr_User_Id_1,'CA');assert.equal(r.Cust_Mngr_User_Id_2,'CB');}
    if(kind==='null-name-mixed-source') {
      assert.equal(r.Cust_Mngr_User_Id_1,'KA');assert.equal(r.Cust_Mngr_Name_1,'NameCA');assert.equal(r.Cust_Mngr_Emp_Id_1,'');
    }
    if(kind==='blank-name-no-fallback')assert.equal(r.Cust_Mngr_Name_1,'');
    if(kind==='top-three') {
      assert.equal(r.Cust_Mngr_User_Id_3,'CC');
      assert.ok(Math.abs(Number(r.Allo_Prop_1)+Number(r.Allo_Prop_2)+Number(r.Allo_Prop_3)-0.9)<1e-12);
    }
    if(kind==='tie-order')assert.equal(r.Cust_Mngr_User_Id_1,'CA');
    if(kind==='source-collision'){assert.equal(r.Cust_Mngr_User_Id_1,'Z0');assert.equal(r.Inr_Org_Id_1,'9000');assert.equal(Number(r.Allo_Prop_1),0.9);}
    if(kind==='hongkong-source-seq'){assert.equal(r.Cust_Mngr_User_Id_1,'H2');assert.equal(r.Main_Oper_User_Id,'H1');assert.equal(r.Intro_Oper_User_Id,'H1');}
    if(kind==='hongkong-internal'){assert.equal(r.Main_Oper_User_Id,'CO');assert.equal(r.Inr_Main_Oper_User_Id,'IO');}
    if(kind==='operator-null-and-blank'){assert.equal(r.Main_Oper_User_Id,'CO');assert.equal(r.Intro_Oper_User_Id,'');assert.equal(r.Intro_Oper_Name,null);}
    if(kind==='unmatched-operator'){assert.equal(r.Main_Oper_User_Id,'UNKNOWN');assert.equal(r.Main_Oper_Name,null);}
    if(kind==='special-switch'){assert.equal(r.Pty_Id,'DEV1100100652');assert.equal(r.Cust_Mngr_User_Id_1,'CA');assert.equal(r.Main_Oper_User_Id,'CO');}
    if(kind==='special-protected'||kind==='special-null-key'){assert.equal(r.Cust_Mngr_User_Id_1,null);assert.equal(r.Main_Oper_User_Id,null);}
    if(kind==='tit-max'){assert.equal(r.Tit_Oper_User_Id,'ZZ');assert.equal(r.Tit_Oper_Name,null);assert.equal(r.Tit_Cust_Mngr_User_Id,'TC');}
    if(kind==='missing-org') {
      assert.equal(r.Inr_Org_Id_1,'0001');assert.equal(r.Div_Org_Id_1,'0001');
      assert.equal(actual.intermediate.find(x=>x.Contract_Code==='A1').Inr_Org_Name_1,null);
      assert.equal(actual.intermediate.find(x=>x.client_id==='C1').Inr_Org_Name_1,'');
      assert.equal(r.Inr_Org_Name_1,'','contract NULL falls back to customer aggregation blank');
    }
    if(kind==='employee-empty-id')assert.equal(r.Cust_Mngr_Emp_Id_1,'');
    if(kind==='employee-null-id')assert.equal(r.Cust_Mngr_Emp_Id_1,'KA');
    if(kind==='filters'){assert.equal(r.Cust_Mngr_User_Id_1,null);assert.equal(r.Main_Oper_User_Id,null);assert.equal(r.Inr_Main_Oper_User_Id,null);assert.equal(r.Tit_Oper_User_Id,null);}
  } finally {db.close();}
});

// Test-only reversal of the named Kingstar reading steps into the frozen SQL shape.
import assert from 'node:assert/strict';
import {scan, parse} from './sql-shape.mjs';

function ctes(sql) {
  const t=scan(sql), out=new Map();
  for(let i=0;i<t.length-2;i++){
    if(t[i].depth===0 && t[i+1].text.toLowerCase()==='as' && t[i+2].text==='('){
      const end=t.slice(i+3).find(x=>x.text===')'&&x.depth===0);
      assert.ok(end,'closed CTE');
      out.set(t[i].text.toLowerCase(),{start:t[i+2].end,end:end.start,body:sql.slice(t[i+2].end,end.start)});
    }
  }
  return out;
}
function inlineFrom(body,name,source) {
  const t=scan(body), hits=[];
  for(let i=0;i<t.length-1;i++){
    if(t[i].text.toLowerCase()==='from' && t[i+1].text.toLowerCase()===name) hits.push(t[i+1]);
  }
  assert.equal(hits.length,1,'one source reference: '+name);
  return body.slice(0,hits[0].start)+'('+source+')'+body.slice(hits[0].end);
}
function resolveDetailFields(text,fields){
  const t=scan(text), out=[];
  for(let i=0;i<t.length;i++){
    if(t[i].text.toLowerCase()==='p'&&t[i+1]?.text==='.'){
      const source=fields.get(t[i+2]?.text.toLowerCase());
      assert.ok(source,'known detail field: '+t[i+2]?.text);
      out.push(source);i+=2;
    }else out.push(t[i].text);
  }
  return out.join(' ');
}
export function inlineKingstarSteps(sql){
  const bodies=ctes(sql);
  const body=name=>{assert.ok(bodies.has(name),'required Kingstar step: '+name);return bodies.get(name).body;};
  const latest=inlineFrom(body('latest_confirmation'),'ranked_confirmations',body('ranked_confirmations'));
  const positions=inlineFrom(body('latest_positions'),'ranked_positions',body('ranked_positions'));
  const details=body('position_details'), q=parse(details);
  assert.equal(q.joins[0].table.toLowerCase(),'latest_positions');
  assert.equal(q.joins[0].alias,'b');
  assert.equal(q.where,'','details cannot filter rows');
  assert.ok(!scan(details).some(t=>t.depth===0&&['distinct','group','having','union','limit','qualify','order'].includes(t.text.toLowerCase())),'details cannot collapse rows');
  const fields=new Map();
  for(const field of q.fields){
    const t=scan(field);
    assert.equal(t.length,5,'detail columns are direct references, not new formulas');
    assert.equal(t[1].text,'.');
    assert.equal(t[3].text.toLowerCase(),'as');
    const name=t[4].text.toLowerCase();
    assert.ok(!fields.has(name),'unique detail field');
    fields.set(name,t.slice(0,3).map(x=>x.text).join(' '));
  }
  assert.deepEqual([...fields.keys()],['key_trade_comfirm_id','un_code','un_name','ins_lng_desc','ins_family','currency','dw_cd_val_desc']);
  const summary=body('underlying_summary'), tokens=scan(summary);
  const from=tokens.find(t=>t.depth===0&&t.text.toLowerCase()==='from');
  const group=tokens.find(t=>t.depth===0&&t.text.toLowerCase()==='group');
  assert.ok(from&&group,'summary has FROM and GROUP BY');
  assert.equal(scan(summary.slice(from.start,group.start)).map(t=>t.text.toLowerCase()).join(' '),'from position_details p','summary consumes details without new joins or filters');
  const expandedDetails=inlineFrom(q.joins.map(j=>j.text).join('\n'),'latest_positions',positions);
  const expandedSummary=resolveDetailFields(summary.slice(0,from.start),fields)+'\n'+expandedDetails+'\n'+resolveDetailFields(summary.slice(group.start),fields);
  const replacements=[['latest_confirmation',latest],['underlying_summary',expandedSummary]]
    .map(([name,text])=>({...bodies.get(name),text})).sort((a,b)=>b.start-a.start);
  for(const r of replacements)sql=sql.slice(0,r.start)+r.text+sql.slice(r.end);
  return sql;
}


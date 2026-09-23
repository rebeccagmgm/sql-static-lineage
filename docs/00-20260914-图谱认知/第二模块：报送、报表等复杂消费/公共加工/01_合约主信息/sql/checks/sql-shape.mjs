// Bounded lexical helper for these four frozen scripts; not a general SQL parser.

function scan(sql) {
 const out=[]; let i=0, depth=0;
 while(i<sql.length){
  const c=sql[i];
  if(/\s/.test(c)){i++;continue;}
  if(sql.startsWith('--',i)){let j=sql.indexOf('\n',i);i=j<0?sql.length:j+1;continue;}
  if(sql.startsWith('/*',i)){let j=sql.indexOf('*/',i+2);if(j<0)throw Error('comment');i=j+2;continue;}
  const start=i;
  if(c==="'"||c==='"'||c.charCodeAt(0)===96){i++;while(i<sql.length){if(sql[i]==='\\'){i+=2;continue;}if(sql[i]===c){if(sql[i+1]===c){i+=2;continue;}i++;break;}i++;}}
  else if(/[a-zA-Z_]/.test(c)){i++;while(i<sql.length&&/[\w$]/.test(sql[i]))i++;}
  else if(/[0-9]/.test(c)){i++;while(i<sql.length&&/[0-9.]/.test(sql[i]))i++;}
  else i++;
  if(c===')')depth--;
  out.push({text:sql.slice(start,i),start,end:i,depth});
  if(c==='(')depth++;
 }
 if(depth!==0)throw Error('unbalanced');
 return out;
}
function parse(sql){
 const tok=scan(sql);
 const insert=tok.find(t=>t.text.toLowerCase()==='insert'&&t.depth===0);
 const sel=tok.find(t=>t.text.toLowerCase()==='select'&&t.depth===0);
 const from=tok.find(t=>t.text.toLowerCase()==='from'&&t.depth===0);
 const where=tok.find(t=>t.text.toLowerCase()==='where'&&t.depth===0&&t.start>from.start);
 let cuts=[sel.end,...tok.filter(t=>t.text===','&&t.depth===0&&t.start>sel.end&&t.start<from.start).map(t=>t.start),from.start];
 const fields=cuts.slice(0,-1).map((p,i)=>sql.slice(p+(i?1:0),cuts[i+1]).trim());
 const queryEnd=where?.start ?? tok.find(t=>t.text===';'&&t.depth===0&&t.start>from.start)?.start ?? sql.length;
 const starts=tok.filter(t=>t.depth===0&&t.start>=from.start&&t.start<queryEnd&&['from','left','inner'].includes(t.text.toLowerCase()));
 const joins=starts.map((s,i)=>{
  const end=starts[i+1]?.start??queryEnd; const text=sql.slice(s.start,end);
  const st=scan(text); const key=st.findIndex(t=>['from','join'].includes(t.text.toLowerCase())); const op=st[key+1]?.text==='('?st[key+1]:null;
  if(!op) {
 const k=st.findIndex(t=>['from','join'].includes(t.text.toLowerCase()));
 let at=k+1;
 while(st[at+1]?.text==='.')at+=2;
 return {text,start:s.start,end,alias:st[at+1].text.toLowerCase(),table:st.slice(k+1,at+1).map(t=>t.text).join(''),body:null};
}
  const cl=st.find(t=>t.text===')'&&t.depth===0&&t.start>op.start);
  const alias=st[st.indexOf(cl)+1].text.toLowerCase();
  return {text,start:s.start,end,alias,body:text.slice(op.end,cl.start),op:op.start,cl:cl.end};
 });
 return {prefix:insert?sql.slice(0,insert.start):'',insert:insert?sql.slice(insert.start,sel.start):'',fields,joins,where:where?sql.slice(where.start):'',sql};
}

export { scan, parse };

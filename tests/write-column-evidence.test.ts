import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTaskInput, writeTableInput } from "../scripts/input/shared/input-pack.ts";
import { prepareInputPackTask } from "../scripts/machine-facts/input-pack-machine-facts.ts";
import { writeColumnsFromSyncLog as parseRun, verifiedWriteColumns } from "../scripts/input/shared/write-column-evidence.ts";
import { verifyRuntimeTargetIdentity, loaderProperty } from "../scripts/input/shared/runtime-target-evidence.ts";
import { deriveOutputFieldBindings, type OutputBindingInput } from "../scripts/machine-facts/output-field-bindings.ts";

const target = {platform:"mysql",dataSource:"gfmysql_db",qualifiedName:"db.out"};
const query = "select b, a from db.source where d='${YYYY-MM-DD}'";
const log = "[2026-09-11 00:00:00]-[INFO] create temp table sql:use temp; CREATE TABLE stage STORED AS TEXTFILE AS select b,a from db.source where d='2026-09-10'\n[2026-09-11 00:00:00]-[INFO] insert.sql: insert into db.out (b,a) values (?,?)";
const datasources = {byServerTag:new Map([['mysql-test',{serverTag:'mysql-test',serverType:'mysql',service:'db',host:'example.test',port:3306}]])};
const input = {taskId:"1",target,query,log,dataDate:"2026-09-10",observedAt:"2026-09-11T00:00:00Z",datasources};
// Ordinary fixtures represent the same CTAS/INSERT passed to one loader.
function writeColumnsFromSyncLog(value: typeof input) {
  const connection = '\n[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${target.db.connection.string} = jdbc:mysql://example.test:3306/db\n';
  if (value.target.platform === "starrocks") return parseRun({...value,log:value.log+connection,datasources:{byServerTag:new Map([['starrocks-test',{serverTag:'starrocks-test',serverType:'starrocks',service:'db',host:'example.test',port:3306}]])}});
  const hive = value.log.match(/create temp table sql:([^\r\n]*)/i)?.[1];
  const insert = value.log.match(/insert\.sql:\s*([^\r\n]*)/i)?.[1];
  return parseRun({...value,log:value.log+connection+`\n[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  \${hive.sql} = ${hive}\n[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  \${insert.sql} = ${insert}\n[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  \${hdfs.path} = /warehouse/temp.db/stage\n`});
}
describe("explicit platform write columns", () => {
  it("requires actual target connection proof and rejects detached header statements", () => {
    const jdbcLog = '[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${empty} = \n[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${target.db.connection.string} = jdbc:mysql://example.test:3306/db';
    const index = {byServerTag:new Map([['mysql-test',{serverTag:'mysql-test',serverType:'mysql',service:'db',host:'example.test',port:3306}]])};
    expect(loaderProperty(jdbcLog,'target.db.connection.string')).toContain('jdbc:mysql:');
    expect(verifyRuntimeTargetIdentity(jdbcLog,{...target,dataSource:'gfmysql_db'},index)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => verifyRuntimeTargetIdentity(jdbcLog.replace('example.test','other.test'),{...target,dataSource:'gfmysql_db'},index)).toThrow('MISMATCH');
    expect(() => verifyRuntimeTargetIdentity(jdbcLog,{...target,dataSource:'other'},index)).toThrow('MISMATCH');
    expect(() => parseRun(input)).toThrow('LOADER_PROPERTY_NOT_PROVEN');
  });
  it("verifies calendar offsets but rejects trading-day and nested variables", () => {
    const dated = {...input, query:query.replace('${YYYY-MM-DD}', '${yyyy-MM-dd,-1M}'), dataDate:'2026-03-31', log:log.replace('2026-09-10', '2026-02-28')};
    expect(writeColumnsFromSyncLog(dated).columns).toEqual(['b','a']);
    expect(writeColumnsFromSyncLog({...dated,query:query.replace('${YYYY-MM-DD}', '${yyyyMMdd,1d}'),log:log.replace('2026-09-10', '20260401')}).columns).toEqual(['b','a']);
    expect(() => writeColumnsFromSyncLog({...dated,query:query.replace('${YYYY-MM-DD}', '${yyyy-MM-dd,-1t}')})).toThrow('TEMPLATE_UNSUPPORTED');
    expect(() => writeColumnsFromSyncLog({...dated,dataDate:'2026-02-30'})).toThrow('DATE_INVALID');
  });
  it("binds StarRocks stream-load columns only with matching query and target", () => {
    const starTarget = {...target, platform:"starrocks",dataSource:"gfstarrocks_db"};
    const starLog = '[2026-09-11 00:00:00]-[INFO] Stream load 参数：{"columns":"b,a","partial_update":"true"}\n' +
      "[2026-09-11 00:00:00]-[INFO] Running sql with Hive:use temp; CREATE TABLE stage STORED AS TEXTFILE AS select b,\na from db.source where d='2026-09-10'\n" +
      '[2026-09-11 00:00:01]-[INFO] done\n' +
      '[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${hdfs.path} = /warehouse/temp.db/stage\n' +
      '[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${target.db.database} = db \n' +
      '[INFO] [09-11 00:00:01] [t1, main, AnyLoader]  ${target.db.table} = out \n';
    expect(writeColumnsFromSyncLog({...input,target:starTarget,log:starLog}).columns).toEqual(["b","a"]);
    expect(() => writeColumnsFromSyncLog({...input,target:starTarget,log:starLog.replace('= out','= other')})).toThrow("TARGET_NOT_MATCHED");
    expect(() => writeColumnsFromSyncLog({...input,target:starTarget,log:starLog.replace('"b,a"','"b,a,x=1"')})).toThrow("INVALID");
    expect(() => writeColumnsFromSyncLog({...input,target:starTarget,log:starLog.replace('select b,','select a,')})).toThrow("QUERY_NOT_MATCHED");
    expect(() => writeColumnsFromSyncLog({...input,target:starTarget,log:starLog.replace('/temp.db/stage','/temp.db/different')})).toThrow("STAGE_NOT_MATCHED");
  });
  it("preserves mapping provenance and keeps changed queries closed on recollection", () => {
    const root = mkdtempSync(join(tmpdir(),"write-columns-test-"));
    try {
      const task = {taskId:"1",taskCategory:"hive2mysql",target,targetEvidenceKind:"DIRECT_PLATFORM_TARGET" as const,
        sql:{query:{content:query,evidenceProvider:"test"}},evidenceProvider:"test"};
      writeTaskInput(root,{...task,writeColumnEvidence:writeColumnsFromSyncLog(input)});
      for (const name of ['out','source']) writeTableInput(root,{...target,qualifiedName:`db.${name}`,objectType:'table',partitionFields:[],ddl:`CREATE TABLE db.${name} (a INT, b INT, d VARCHAR(20));`,evidenceProvider:'synthetic:test'});
      expect(prepareInputPackTask({dataRoot:root,taskId:'1'}).profileTask.platform_target_query_output?.target_columns).toEqual(['b','a']);
      writeTaskInput(root,task);
      const read = () => JSON.parse(readFileSync(join(root,"tasks/hive2mysql/1/task.json"),"utf8"));
      expect(read().writeColumnEvidence.columns).toEqual(["b","a"]);
      writeTaskInput(root,{...task,sql:{query:{content:query+" limit 1",evidenceProvider:"test"}}});
      expect(() => verifiedWriteColumns(read().writeColumnEvidence,query+" limit 1",target)).toThrow("STALE");
      expect(() => prepareInputPackTask({dataRoot:root,taskId:'1'})).toThrow("STALE");
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
  it("accepts only matching query and unambiguous positional INSERT evidence", () => {
    const e = writeColumnsFromSyncLog(input);
    expect(e.columns).toEqual(["b","a"]);
    expect(verifiedWriteColumns(e,query,target)).toEqual(e);
    expect(() => verifiedWriteColumns(e,query+" limit 1",target)).toThrow("STALE");
    expect(() => verifiedWriteColumns(e,query,{...target,dataSource:"other"})).toThrow("STALE");
    expect(() => writeColumnsFromSyncLog({...input,log:log.replace("select b,a","select a,b")})).toThrow("QUERY_NOT_MATCHED");
    expect(() => writeColumnsFromSyncLog({...input,log:log+"\n[2026-09-11 00:00:00]-[INFO] insert.sql: insert into db.out(a,b) values (?,?)"})).toThrow("LOADER_INSERT_NOT_MATCHED");
    expect(() => writeColumnsFromSyncLog({...input,log:log.replace("(b,a)","(a,a)")})).toThrow("INVALID");
    expect(() => writeColumnsFromSyncLog({...input,log:log.replace("values (?,?)","values (?,func(?))")})).toThrow("NOT_POSITIONAL");
  });
  it("maps placeholders across injected literal values without shifting source ordinals", () => {
    const withLiteral = log.replace('(b,a) values (?,?)', "(b,run_date,note,a) values (?,'2026-09-10','a,b''c',?)");
    expect(writeColumnsFromSyncLog({...input,log:withLiteral}).columns).toEqual(["b","a"]);
    expect(writeColumnsFromSyncLog({...input,log:log.replace('(b,a) values (?,?)',"(id,b,stamp,a) values (SYS_GUID(),?,to_date('2026-09-10','yyyy-mm-dd'),?)")}).columns).toEqual(["b","a"]);
    expect(writeColumnsFromSyncLog({...input,log:log.replace('(b,a) values (?,?)',"(id,b,stamp,a) values (SYS_GUID(),?,SYSDATE,?)")}).columns).toEqual(["b","a"]);
    expect(() => writeColumnsFromSyncLog({...input,log:withLiteral.replace('(b,run_date,note,a)','(b,b,note,a)')})).toThrow("INVALID");
    expect(() => writeColumnsFromSyncLog({...input,log:withLiteral.replace("'a,b''c'",'source_column')})).toThrow("NOT_POSITIONAL");
  });
  const bind = (columns?: string[], partitionColumns: string[] = []) => deriveOutputFieldBindings({
    taskId:"1", logicalSourceId:"test", statements:[], declaredWrites:[],
    schemaRefs:[{schema_ref_id:"s",qualified_name:"db.out",status:"SUCCESS",physical_columns:["id","a","b"],partition_columns:partitionColumns}],
    writes:[{writeObservationId:"w",statementId:"stmt",statementType:"PLATFORM_TARGET_QUERY",writeKind:"PACK_DECLARED_QUERY_OUTPUT",rawSql:query,target:"db.out",queryProducerStatementId:"stmt",queryBoundaryProven:true,producerEnumerationStatus:"COMPLETE",evidenceKind:"PACK_DECLARED_QUERY_OUTPUT",partitionStatus:"NOT_PARTITIONED",partitionColumns:[],partitionMode:"NONE",targetColumns:columns,expressions:[{expression_id:"e0",ordinal:0},{expression_id:"e1",ordinal:1}]}],
  } as unknown as OutputBindingInput);
  it("binds the explicit subset in source order without shifting over generated columns", () => {
    const result = bind(["b","a"]);
    expect(result.unknowns).toEqual([]);
    expect(result.bindings.map(b => [b.source_ordinal,b.target_field,b.target_ordinal,b.binding_method])).toEqual([
      [0,"b",2,"EXPLICIT_TARGET_COLUMN_LIST"],[1,"a",1,"EXPLICIT_TARGET_COLUMN_LIST"],
    ]);
  });
  it("keeps missing, duplicate, unknown and wrong-width mappings closed", () => {
    for (const columns of [undefined,["a","a"],["a","missing"],["a"]]) expect(bind(columns).bindings).toHaveLength(0);
    expect(bind(["a","b"],["b"]).bindings).toHaveLength(0);
  });
});

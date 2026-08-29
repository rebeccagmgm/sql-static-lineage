import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDifferentialSchema } from "../calcite-differential/schema-type-projection.ts";
import { adaptHiveCompatSql, type DialectTransformResult } from "./dialect-adapter.ts";
import type { CalciteSemanticProviderRequest, ProviderTable } from "./protocol.ts";

interface SchemaSnapshot {
  readonly records: readonly { readonly qualified_name: string; readonly ddl_sha256: string }[];
}
export interface RealProviderInput {
  readonly request: CalciteSemanticProviderRequest;
  readonly dialectTransform: DialectTransformResult;
  readonly evidence: { readonly sqlPath: string; readonly schemaSnapshotPath: string; readonly relationNodesPath: string; readonly ddlPaths: readonly string[] };
}

export function buildRealProviderInput(input: {
  readonly dataRoot: string;
  readonly sqlPath: string;
  readonly schemaSnapshotPath: string;
  readonly taskId: string;
  readonly sqlSourceId: string;
}): RealProviderInput {
  const rawSql = readFileSync(input.sqlPath, "utf8");
  const transform = adaptHiveCompatSql(rawSql);
  const snapshot = JSON.parse(readFileSync(input.schemaSnapshotPath, "utf8")) as SchemaSnapshot;
  const ddlPaths: string[] = [];
  const tables = snapshot.records.map((record) => {
    const ddlPath = join(input.dataRoot, "tables", "hive", `${record.qualified_name.toLowerCase()}__gfhive`, "ddl.sql");
    if (!existsSync(ddlPath)) throw new Error(`exact DDL missing for ${record.qualified_name}`);
    ddlPaths.push(ddlPath);
    const [schema, ...nameParts] = record.qualified_name.split(".");
    if (!schema || nameParts.length !== 1) throw new Error(`unsupported physical table identity ${record.qualified_name}`);
    return {
      schema,
      name: nameParts[0]!,
      ddl: readFileSync(ddlPath, "utf8"),
      evidenceRefs: [`ddl-sha256:${record.ddl_sha256}`],
    };
  });
  const projection = projectDifferentialSchema({ tables, dialect: "hive" });
  if (projection.status !== "SUCCESS" || !projection.schema) {
    throw new Error(`typed schema projection failed: ${projection.issues.map((issue) => `${issue.code}:${issue.path}`).join(", ")}`);
  }
  const providerTables: ProviderTable[] = projection.schema.tables.map((table) => ({
    ...(table.catalog ? { catalog: table.catalog } : {}),
    schema: table.schema ?? "",
    name: table.name,
    columns: table.columns.map((column) => ({ name: column.name, type: column.type, nullable: column.nullable })),
  }));
  if (providerTables.some((table) => table.schema === "")) throw new Error("schema projection lost exact schema identity");
  return {
    request: {
      protocolVersion: 1,
      requestId: `real:${input.taskId}:statement:0`,
      sqlSourceId: input.sqlSourceId,
      statementOrdinal: 0,
      dialect: "HIVE_COMPAT",
      sql: transform.sql,
      schema: { tables: providerTables },
      requestedMetadata: ["expressionLineage", "predicates", "uniqueKeys", "functionalDependencies", "tableOccurrences", "rowCountCardinality"],
      limits: { maxInputBytes: 262144, maxSqlBytes: 65536, maxTables: 128, maxColumnsPerTable: 256, maxRelNodes: 4096, maxOutputItems: 4096, maxOutputBytes: 4194304 },
    },
    dialectTransform: transform,
    evidence: {
      sqlPath: input.sqlPath,
      schemaSnapshotPath: input.schemaSnapshotPath,
      relationNodesPath: join(input.dataRoot, "field-facts", "registry", "tasks", input.taskId, "bundle", "relation-nodes.jsonl"),
      ddlPaths,
    },
  };
}

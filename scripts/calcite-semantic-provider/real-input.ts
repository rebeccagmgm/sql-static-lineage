import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDifferentialSchema } from "../calcite-differential/schema-type-projection.ts";
import {
  loadPhysicalTableCatalog,
  prepareInputPackTask,
  type PhysicalTableCatalogEntry,
} from "../machine-facts/input-pack-machine-facts.ts";
import { sha256 } from "../machine-facts/machine-facts-contract.ts";
import {
  adaptHiveCompatSql,
  type DialectTransformResult,
} from "./dialect-adapter.ts";
import type {
  CalciteSemanticProviderRequest,
  ProviderTable,
} from "./protocol.ts";

export interface RealProviderInput {
  readonly request: CalciteSemanticProviderRequest;
  readonly dialectTransform: DialectTransformResult;
  readonly evidence: {
    readonly taskPath: string;
    readonly sqlPath: string;
    readonly sqlLocator: string;
    readonly sqlSha256: string;
    readonly schemaBundleSha256: string;
    readonly relationNodesPath: string;
    readonly ddlPaths: readonly string[];
  };
}

export function buildRealProviderInput(input: {
  readonly dataRoot: string;
  readonly taskId: string;
}): RealProviderInput {
  const catalog = loadPhysicalTableCatalog(input.dataRoot, { lazyDdl: true });
  const prepared = prepareInputPackTask({
    dataRoot: input.dataRoot,
    taskId: input.taskId,
    tableCatalog: catalog,
  });
  const target = exactTargetStatementSource({
    dataRoot: input.dataRoot,
    taskId: input.taskId,
    sources: prepared.sqlSources,
  });
  if (prepared.dialect !== "databricks") {
    throw new Error(`CALCITE_DIALECT_PROFILE_UNSUPPORTED:${prepared.dialect}`);
  }
  const rawSql = target.rawSql;
  const transform = adaptHiveCompatSql(rawSql);
  const ddlPaths: string[] = [];
  const records = schemaRecords(prepared.schemaBundle);
  const tables = records.map((record) => {
    const entry = exactCatalogEntry(
      catalog.byQualifiedName,
      record.qualifiedName,
    );
    if (record.ddlSha256 !== entry.ddlSha256) {
      throw new Error(
        `INPUT_PACK_DDL_IDENTITY_MISMATCH:${record.qualifiedName}`,
      );
    }
    if (!existsSync(entry.ddlPath))
      throw new Error(`exact DDL missing for ${record.qualifiedName}`);
    ddlPaths.push(entry.ddlPath);
    const [schema, ...nameParts] = record.qualifiedName.split(".");
    if (!schema || nameParts.length !== 1)
      throw new Error(
        `unsupported physical table identity ${record.qualifiedName}`,
      );
    return {
      schema,
      name: nameParts[0]!,
      ddl: readFileSync(entry.ddlPath, "utf8"),
      evidenceRefs: [`ddl-sha256:${record.ddlSha256}`],
    };
  });
  const projection = projectDifferentialSchema({ tables, dialect: "hive" });
  if (projection.status !== "SUCCESS" || !projection.schema) {
    throw new Error(
      `typed schema projection failed: ${projection.issues.map((issue) => `${issue.code}:${issue.path}`).join(", ")}`,
    );
  }
  const providerTables: ProviderTable[] = projection.schema.tables.map(
    (table) => ({
      ...(table.catalog ? { catalog: table.catalog } : {}),
      schema: table.schema ?? "",
      name: table.name,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable,
      })),
    }),
  );
  if (providerTables.some((table) => table.schema === ""))
    throw new Error("schema projection lost exact schema identity");
  const sqlSourceId = target.statementId;
  return {
    request: {
      protocolVersion: 1,
      requestId: `calcite-poc:${sqlSourceId}`,
      sqlSourceId,
      statementOrdinal: target.statementOrdinal,
      dialect: "HIVE_COMPAT",
      sql: transform.sql,
      schema: { tables: providerTables },
      requestedMetadata: [
        "expressionLineage",
        "predicates",
        "uniqueKeys",
        "functionalDependencies",
        "tableOccurrences",
        "rowCountCardinality",
      ],
      limits: {
        maxInputBytes: 262144,
        maxSqlBytes: 65536,
        maxTables: 128,
        maxColumnsPerTable: 256,
        maxRelNodes: 4096,
        maxOutputItems: 4096,
        maxOutputBytes: 4194304,
      },
    },
    dialectTransform: transform,
    evidence: {
      taskPath: prepared.taskPath,
      sqlPath: target.source.path,
      sqlLocator: `${target.source.locator}#${target.statementId}`,
      sqlSha256: sha256(rawSql),
      schemaBundleSha256: prepared.schemaBundleHash,
      relationNodesPath: join(
        input.dataRoot,
        "field-facts",
        "registry",
        "tasks",
        input.taskId,
        "bundle",
        "relation-nodes.jsonl",
      ),
      ddlPaths: [...ddlPaths].sort(),
    },
  };
}

type PreparedSqlSource = {
  readonly slot: string;
  readonly path: string;
  readonly locator: string;
  readonly sha256: string;
  readonly content: string;
};

type TargetStatementSource = {
  readonly statementId: string;
  readonly statementOrdinal: number;
  readonly rawSql: string;
  readonly source: PreparedSqlSource;
};

function exactTargetStatementSource(input: {
  readonly dataRoot: string;
  readonly taskId: string;
  readonly sources: readonly PreparedSqlSource[];
}): TargetStatementSource {
  const artifact = readRecord(
    join(
      input.dataRoot,
      "artifacts",
      "tasks",
      input.taskId,
      "field-lineage.json",
    ),
    "CALCITE_ROOT_ARTIFACT_INVALID",
  );
  const request = record(artifact.request);
  const rootWrites = strings(request?.rootWriteObservationIds);
  if (rootWrites.length !== 1) {
    throw new Error(
      `CALCITE_ROOT_WRITE_REQUIRES_UNIQUE_OBSERVATION:count=${rootWrites.length}`,
    );
  }
  const bundleRoot = join(
    input.dataRoot,
    "field-facts",
    "registry",
    "tasks",
    input.taskId,
    "bundle",
  );
  const statementIds = [
    ...new Set(
      readJsonl(
        join(bundleRoot, "output-field-bindings.jsonl"),
        "CALCITE_ROOT_OUTPUT_BINDINGS_INVALID",
      )
        .filter(
          (binding) =>
            binding.task_id === input.taskId &&
            binding.write_observation_id === rootWrites[0],
        )
        .map((binding) => binding.statement_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (statementIds.length !== 1) {
    throw new Error(
      `CALCITE_ROOT_STATEMENT_REQUIRES_UNIQUE_BINDING:count=${statementIds.length}`,
    );
  }
  const statementId = statementIds[0]!;
  const identity = statementIdentity(statementId, input.taskId);
  const statementRecords = readJsonl(
    join(bundleRoot, "statements.jsonl"),
    "CALCITE_ROOT_STATEMENTS_INVALID",
  ).filter((statement) => statement.statement_id === statementId);
  if (statementRecords.length !== 1) {
    throw new Error(
      `CALCITE_ROOT_STATEMENT_RECORD_NOT_UNIQUE:count=${statementRecords.length}`,
    );
  }
  const machineFactsSql =
    typeof statementRecords[0]!.raw_sql === "string"
      ? statementRecords[0]!.raw_sql
      : "";
  if (!machineFactsSql) throw new Error("CALCITE_ROOT_STATEMENT_SQL_MISSING");
  const sources = input.sources.filter(
    (source) => source.slot === identity.slot,
  );
  if (sources.length !== 1) {
    throw new Error(
      `CALCITE_ROOT_SQL_SOURCE_NOT_UNIQUE:slot=${identity.slot}:count=${sources.length}`,
    );
  }
  const source = sources[0]!;
  const rawSql = exactStatementSqlInSource(source.content, machineFactsSql);
  return {
    statementId,
    statementOrdinal: identity.statementOrdinal,
    rawSql,
    source,
  };
}

function exactStatementSqlInSource(
  sourceSql: string,
  machineFactsSql: string,
): string {
  const candidates = [
    machineFactsSql,
    machineFactsSql.replace(/\s*;\s*$/, ""),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  for (const candidate of candidates) {
    const firstIndex = sourceSql.indexOf(candidate);
    const secondIndex =
      firstIndex < 0 ? -1 : sourceSql.indexOf(candidate, firstIndex + 1);
    if (firstIndex >= 0 && secondIndex < 0) return candidate;
  }
  throw new Error("CALCITE_ROOT_STATEMENT_NOT_UNIQUE_IN_SOURCE");
}

function statementIdentity(
  statementId: string,
  taskId: string,
): { readonly slot: string; readonly statementOrdinal: number } {
  const match = /^task:([^:]+):slot:([^:]+):statement:(\d+)$/.exec(statementId);
  if (!match || match[1] !== taskId) {
    throw new Error(`CALCITE_ROOT_STATEMENT_ID_UNSUPPORTED:${statementId}`);
  }
  return { slot: match[2]!, statementOrdinal: Number(match[3]) };
}

function readRecord(path: string, code: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${code}:${path}`);
  }
  const result = record(value);
  if (!result) throw new Error(`${code}:${path}`);
  return result;
}

function readJsonl(path: string, code: string): Record<string, unknown>[] {
  try {
    return readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const value: unknown = JSON.parse(line);
        const result = record(value);
        if (!result) throw new Error(code);
        return result;
      });
  } catch {
    throw new Error(`${code}:${path}`);
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function schemaRecords(bundle: Record<string, unknown>): readonly {
  readonly qualifiedName: string;
  readonly ddlSha256: string;
}[] {
  if (!Array.isArray(bundle.records))
    throw new Error("INPUT_PACK_SCHEMA_BUNDLE_INVALID");
  return bundle.records.map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("INPUT_PACK_SCHEMA_RECORD_INVALID");
    }
    const record = value as Record<string, unknown>;
    const qualifiedName =
      typeof record.qualified_name === "string"
        ? record.qualified_name.trim().toLowerCase()
        : "";
    const ddlSha256 =
      typeof record.ddl_sha256 === "string" ? record.ddl_sha256 : "";
    if (!qualifiedName || !ddlSha256)
      throw new Error(
        `INPUT_PACK_SCHEMA_RECORD_UNSUPPORTED:${qualifiedName || "UNKNOWN"}`,
      );
    return { qualifiedName, ddlSha256 };
  });
}

function exactCatalogEntry(
  byQualifiedName: ReadonlyMap<string, readonly PhysicalTableCatalogEntry[]>,
  qualifiedName: string,
): PhysicalTableCatalogEntry {
  const matches = byQualifiedName.get(qualifiedName) ?? [];
  if (matches.length !== 1)
    throw new Error(
      `INPUT_PACK_PHYSICAL_TABLE_NOT_EXACT:${qualifiedName}:matches=${matches.length}`,
    );
  return matches[0]!;
}

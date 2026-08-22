/**
 * Temporary reader for the Plan Adapter layer.
 *
 * This is deliberately one layer above src and one layer below Machine Facts:
 *   SQL -> SqlSession/ScopeTree -> buildPlanFacts() -> PlanFacts summary
 *
 * It does not write bundles, JSONL, manifests, or Machine Facts. It writes a
 * temporary summary under tmp/inspect-results unless --output overrides it.
 * With --tables-root it derives a transient Schema from table.json + ddl.sql evidence.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { SqlSession } from "../src/index.js";
import { buildPlanFacts } from "../scripts/plans/plan-adapter.ts";
import { loadSchemaFromTablesRoot } from "../scripts/plans/ddl-schema.ts";
import {
  normalizeConcatenatedSqlStatements,
  normalizeRepeatedSqlContent,
  tableFromDirectEvidence,
} from "../scripts/input/collect-one-task-input-pack.ts";
import { writeTableInput } from "../scripts/input/input-pack.ts";
import { controlledTaskEndpointDataSource } from "../scripts/input/task-endpoints.ts";
import { taskSqlDialect } from "../scripts/plans/task-sql-dialect.ts";

type JsonRecord = Record<string, unknown>;

const DEFAULT_DATA_ROOT =
  "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-data";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArg(name: string, fallback?: string): string {
  const value = arg(name) ?? fallback;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function safePathSegment(value: string, name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value))
    throw new Error(`unsafe ${name}: ${value}`);
  return value;
}

function findTask(dataRoot: string, taskId: string, category?: string): string {
  const tasksRoot = join(dataRoot, "tasks");
  const categories = category ? [category] : readdirSync(tasksRoot);
  const matches = categories
    .map((currentCategory) => join(tasksRoot, currentCategory, taskId))
    .filter((taskDir) => existsSync(join(taskDir, "task.json")));
  if (matches.length !== 1) {
    throw new Error(
      `expected one task match for ${taskId}, got: ${matches.join(", ") || "none"}`,
    );
  }
  return matches[0]!;
}

function relationSummary(relation: any): JsonRecord {
  return {
    id: relation.id,
    type: relation.type,
    ...(relation.table ? { table: relation.table } : {}),
    ...(relation.binding ? { binding: relation.binding } : {}),
    ...(relation.source ? { source: relation.source } : {}),
    ...(relation.left ? { left: relation.left } : {}),
    ...(relation.right ? { right: relation.right } : {}),
    ...(relation.branches ? { branches: relation.branches } : {}),
    ...(relation.join_type ? { join_type: relation.join_type } : {}),
  };
}

function resolutionSummary(plan: any): JsonRecord {
  const counts: Record<string, number> = {};
  const expressions: any[] = [];
  for (const relation of plan.relations ?? []) {
    for (const expression of [
      ...(relation.expressions ?? []),
      ...(relation.measures ?? []),
    ]) {
      expressions.push(expression);
      for (const input of expression.input_columns ?? []) {
        const resolution = String(input.resolution ?? "UNSET_WITHOUT_SCHEMA");
        counts[resolution] = (counts[resolution] ?? 0) + 1;
      }
    }
  }
  return {
    counts,
    expression_count: expressions.length,
    sample: expressions.slice(0, 5).map((expression) => ({
      id: expression.expression_id,
      output: expression.output,
      expr_kind: expression.expr_kind,
      input_columns: expression.input_columns,
    })),
  };
}

function normalizeSqlForInspection(sql: string): {
  content: string;
  warnings: string[];
} {
  const repeated = normalizeRepeatedSqlContent(sql);
  const separated = normalizeConcatenatedSqlStatements(repeated.content);
  return {
    content: separated.content,
    warnings: [
      repeated.duplicateBlocksRemoved
        ? "SQL_DUPLICATE_BLOCK_REMOVED"
        : undefined,
      separated.separatorsInserted > 0
        ? `SQL_STATEMENT_SEPARATOR_INSERTED:${separated.separatorsInserted}`
        : undefined,
    ].filter((value): value is string => value !== undefined),
  };
}

function inspectSql(
  sql: string,
  filePath: string,
  dataRoot: string,
  schema?: unknown,
  systemValueNames: readonly string[] = [],
  dialect = "databricks",
): JsonRecord {
  const normalized = normalizeSqlForInspection(sql);
  sql = normalized.content;
  const session = SqlSession.create(
    sql,
    dialect as any,
    schema ? { schema: schema as any } : undefined,
  );
  return {
    file: relative(dataRoot, filePath),
    bytes: Buffer.byteLength(sql, "utf8"),
    ...(normalized.warnings.length > 0
      ? { input_normalization_warnings: normalized.warnings }
      : {}),
    statements: session.doc.statements.flatMap((cell, statementIndex) => {
      if (cell.text.trim() === "") return [];
      const plan = buildPlanFacts(cell, sql, {
        statement_index: statementIndex,
        dialect: dialect as any,
        include_expression_dependencies: true,
        system_value_names: systemValueNames,
        ...(schema ? { schema } : {}),
      });
      const hopRoots = plan.lineage_hops.roots;
      return [{
        index: statementIndex,
        category: cell.category,
        syntax_errors: cell.errors,
        meta: {
          contract_version: plan.meta.contract_version,
          adapter_version: plan.meta.adapter_version,
          parser: plan.meta.parser,
        },
        roots: plan.roots,
        physical_inputs: plan.physical_inputs,
        relation_counts: plan.relations.reduce(
          (counts: Record<string, number>, relation) => {
            counts[relation.type] = (counts[relation.type] ?? 0) + 1;
            return counts;
          },
          {},
        ),
        relation_graph: plan.relations.map(relationSummary),
        value_lineage: {
          root_count: hopRoots.length,
          node_count: plan.lineage_hops.nodes.length,
          edge_count: plan.lineage_hops.edges.length,
          coverage_counts: hopRoots.reduce(
            (counts: Record<string, number>, root) => {
              const key = `${root.coverage_state}/${root.projection_status}`;
              counts[key] = (counts[key] ?? 0) + 1;
              return counts;
            },
            {},
          ),
        },
        field_resolution: resolutionSummary(plan),
        unknown_count: plan.unknowns.length,
        unknown_sample: plan.unknowns.slice(0, 8),
      }];
    }),
  };
}

function discoverPhysicalInputs(
  filePaths: readonly string[],
  systemValueNames: readonly string[] = [],
  dialect = "databricks",
): string[] {
  const names = new Set<string>();
  for (const filePath of filePaths) {
    const sql = normalizeSqlForInspection(readFileSync(filePath, "utf8")).content;
    const session = SqlSession.create(sql, dialect as any);
    for (const [statementIndex, cell] of session.doc.statements.entries()) {
      const plan = buildPlanFacts(cell, sql, {
        statement_index: statementIndex,
        dialect: dialect as any,
        include_expression_dependencies: true,
        system_value_names: systemValueNames,
      });
      for (const table of plan.physical_inputs) names.add(table);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

function main(): void {
  const dataRoot = resolve(requiredArg("--data-root", DEFAULT_DATA_ROOT));
  const taskId = requiredArg("--task-id");
  const category = arg("--category");
  const requestedSlot = arg("--slot") ?? "query";
  const taskDir = findTask(dataRoot, taskId, category);
  const task = JSON.parse(
    readFileSync(join(taskDir, "task.json"), "utf8"),
  ) as JsonRecord;
  const taskCategory = safePathSegment(
    String(task.taskCategory ?? category ?? "unknown"),
    "task category",
  );
  const dialect = taskSqlDialect(taskCategory);
  const taskIdSegment = safePathSegment(
    String(task.taskId ?? taskId),
    "task id",
  );
  const target =
    task.target && typeof task.target === "object"
      ? (task.target as JsonRecord)
      : undefined;
  const targetPlatform = String(target?.platform ?? "").toLowerCase();
  const systemValueNames =
    taskCategory.toLowerCase() === "hive2oracle" || targetPlatform === "oracle"
      ? ["sysdate"]
      : [];
  const declaredFiles = Array.isArray(task.sqlFiles) ? task.sqlFiles : [];
  const filePaths = declaredFiles
    .filter((entry) => (entry as JsonRecord).slot === requestedSlot)
    .map((entry) => (entry as JsonRecord).path)
    .filter((path): path is string => typeof path === "string")
    .map((path) => resolve(taskDir, path));
  if (filePaths.length === 0)
    throw new Error(`slot ${requestedSlot} not found in ${taskDir}`);
  const tablesRootArg = arg("--tables-root");
  const fetchSzdata = process.argv.includes("--fetch-szdata");
  const tablesRoot =
    tablesRootArg || fetchSzdata
      ? resolve(tablesRootArg ?? join(dataRoot, "tables"))
      : undefined;
  const physicalInputs = discoverPhysicalInputs(
    filePaths,
    systemValueNames,
    dialect,
  );
  let schemaLoad = tablesRoot
    ? loadSchemaFromTablesRoot(tablesRoot, physicalInputs)
    : undefined;
  let fetchSummary: JsonRecord | undefined;
  if (fetchSzdata && tablesRoot && schemaLoad) {
    const requestedFetchNames = [...schemaLoad.missing];
    const expectedDataSource = controlledTaskEndpointDataSource(
      taskCategory,
      "source",
    );
    const fetched: JsonRecord[] = [];
    const unavailable: string[] = [];
    const failures: JsonRecord[] = [];
    for (const qualifiedName of requestedFetchNames) {
      console.error(JSON.stringify({ progress: "szdata", qualifiedName }));
      try {
        const evidence = tableFromDirectEvidence(
          qualifiedName,
          undefined,
          expectedDataSource,
        );
        if (!evidence) {
          unavailable.push(qualifiedName);
          continue;
        }
        const result = writeTableInput(dataRoot, evidence);
        fetched.push({
          qualified_name: evidence.qualifiedName,
          changed: result.changed,
          directory: result.directory,
        });
      } catch (error) {
        failures.push({
          qualified_name: qualifiedName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    schemaLoad = loadSchemaFromTablesRoot(tablesRoot, physicalInputs);
    fetchSummary = {
      requested: requestedFetchNames.length,
      fetched: fetched.length,
      unavailable,
      failures,
      written: fetched,
    };
  }
  const analysisSchema =
    schemaLoad && schemaLoad.loaded.length > 0 ? schemaLoad.schema : undefined;
  const summary = {
    task: { id: task.taskId, category: task.taskCategory, name: task.taskName },
    dialect,
    schema_mode: tablesRoot
      ? analysisSchema
        ? schemaLoad?.missing.length
          ? "ddl_from_tables_partial_open_world"
          : "ddl_from_tables"
        : "ddl_from_tables_no_match"
      : "not supplied",
    physical_inputs: physicalInputs,
    szdata_fetch: fetchSummary,
    schema_load: schemaLoad
      ? {
          tables_root: tablesRoot,
          loaded: schemaLoad.loaded,
          missing: schemaLoad.missing,
          issues: schemaLoad.issues,
        }
      : undefined,
    files: filePaths.map((filePath) =>
      inspectSql(
        readFileSync(filePath, "utf8"),
        filePath,
        dataRoot,
        analysisSchema,
        systemValueNames,
        dialect,
      ),
    ),
  };
  const outputPath = resolve(
    arg("--output") ??
      join(
        import.meta.dirname,
        "inspect-results",
        taskCategory,
        taskIdSegment,
        `${safePathSegment(requestedSlot, "slot")}.summary.json`,
      ),
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.error(
    JSON.stringify({ progress: "summary_written", path: outputPath }),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main();

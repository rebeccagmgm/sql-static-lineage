import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Schema, SqlSession } from "../../src/index.ts";
import {
  sha256File,
  sha256Text,
  writeTableInput,
  writeTaskInput,
} from "../../scripts/input/shared/input-pack.ts";
import { buildPlanFacts } from "../../scripts/plans/plan-adapter.ts";
import type {
  PlanFacts,
  PlanRelation,
} from "../../scripts/plans/plan-contract.ts";
import { loadMachineFactsGateInput } from "../../scripts/calcite-differential/machine-facts-gate-input.ts";

const TASK_ID = "gate-task";
const LOGICAL_SOURCE_ID = "gate-source";
const STATEMENT_ID = `task:${TASK_ID}:statement:0`;
const SQL = "SELECT s.id FROM pdata_n.source s WHERE s.flag = 'Y';";
const roots: string[] = [];

type JsonRecord = Record<string, unknown>;

interface GateFixture {
  readonly parent: string;
  readonly dataRoot: string;
  readonly bundle: string;
  readonly taskPath: string;
  readonly sqlPath: string;
  readonly tableDirectory: string;
  readonly ddlPath: string;
  readonly plan: PlanFacts;
  readonly relationRows: readonly JsonRecord[];
  readonly schemaRef: JsonRecord;
}

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("fixture record expected");
  }
  return value as JsonRecord;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function relativeLocator(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function globalRelationId(localId: string): string {
  return `${STATEMENT_ID}:relation:${localId}`;
}

function globalizeRelation(relation: PlanRelation): JsonRecord {
  const raw = clone(relation) as unknown as JsonRecord;
  const id = String(raw.id);
  const globalId = globalRelationId(id);
  raw.id = globalId;

  for (const key of ["source", "left", "right"]) {
    if (typeof raw[key] === "string")
      raw[key] = globalRelationId(String(raw[key]));
  }
  if (Array.isArray(raw.branches)) {
    raw.branches = raw.branches.map((branch) =>
      typeof branch === "string" ? globalRelationId(branch) : branch,
    );
  }
  if (raw.type === "read") {
    const occurrenceId = String(raw.read_occurrence_id ?? id);
    raw.read_occurrence_id = globalRelationId(occurrenceId);
    const occurrence = asRecord(raw.read_occurrence ?? {});
    raw.read_occurrence = {
      ...occurrence,
      occurrence_id: globalRelationId(occurrenceId),
      relation_id: globalId,
    };
  }
  return raw;
}

function jsonlText(rows: readonly JsonRecord[]): string {
  return (
    rows.map((row) => JSON.stringify(row)).join("\n") +
    (rows.length > 0 ? "\n" : "")
  );
}

function writeJsonl(path: string, rows: readonly JsonRecord[]): void {
  writeFileSync(path, jsonlText(rows), "utf8");
}

function outputRecord(
  bundle: string,
  path: string,
  schemaVersion: string,
  rows: readonly JsonRecord[],
): JsonRecord {
  const outputPath = join(bundle, path);
  writeJsonl(outputPath, rows);
  return {
    path,
    schema_version: schemaVersion,
    row_count: rows.length,
    content_sha256: sha256File(outputPath),
  };
}

function currentPlan(): PlanFacts {
  const schema = new Schema({
    pdata_n: {
      source: {
        id: "BIGINT",
        flag: "STRING",
      },
    },
  });
  const session = SqlSession.create(SQL, "databricks", { schema });
  const statement = session.doc.statements[0];
  if (!statement || statement.errors > 0)
    throw new Error("fixture SQL did not parse");
  return buildPlanFacts(statement, SQL, {
    statement_index: 0,
    dialect: "databricks",
    schema,
    include_expression_dependencies: true,
  });
}

function legacyRelationRows(
  plan: PlanFacts,
  mutate?: (relation: JsonRecord) => void,
): readonly JsonRecord[] {
  return plan.relations.map((item) => {
    const relation = globalizeRelation(item);
    if (relation.type === "read") {
      relation.read_occurrence_id = "legacy-read-occurrence";
      relation.read_occurrence = {
        occurrence_id: "legacy-read-occurrence",
        relation_id: relation.id,
        scope_id: "root",
        source_span: relation.span,
      };
    }
    if (relation.type === "filter") relation.clause = "legacy-clause";
    mutate?.(relation);
    return {
      relation_id: relation.id,
      task_id: TASK_ID,
      statement_id: STATEMENT_ID,
      relation_type: relation.type,
      source_span: relation.span,
      provenance: "SQL_PLAN",
      relation,
    };
  });
}

function createFixture(
  options: {
    readonly mutateRelation?: (relation: JsonRecord) => void;
    readonly mutateSchemaRef?: (schemaRef: JsonRecord) => void;
    readonly mutateDdl?: boolean;
  } = {},
): GateFixture {
  const parent = mkdtempSync(join(tmpdir(), "calcite-gate-input-"));
  roots.push(parent);
  const dataRoot = join(parent, "data");
  const plan = currentPlan();

  const table = writeTableInput(dataRoot, {
    platform: "hive",
    dataSource: "warehouse",
    qualifiedName: "pdata_n.source",
    guid: "source-guid",
    objectType: "hive_table",
    partitionFields: [],
    ddl: "CREATE TABLE pdata_n.source (id BIGINT, flag STRING);",
    evidenceProvider: "synthetic:gate-input",
    collectedAt: "2026-08-28T00:00:00.000Z",
  });
  const task = writeTaskInput(dataRoot, {
    taskId: TASK_ID,
    taskCategory: "hiveTask",
    taskName: "pdata_n.gate_task",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "pdata_n.output",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content: SQL,
        evidenceProvider: "synthetic:gate-input",
      },
    },
    evidenceProvider: "synthetic:gate-input",
    collectedAt: "2026-08-28T00:00:00.000Z",
  });
  const taskPath = join(task.directory, "task.json");
  const sqlPath = join(task.directory, "sql", "query.sql");
  const ddlPath = join(table.directory, "ddl.sql");
  const bundle = join(
    dataRoot,
    "field-facts",
    "registry",
    "tasks",
    TASK_ID,
    "bundle",
  );
  mkdirSync(bundle, { recursive: true });

  const schemaRef: JsonRecord = {
    schema_ref_id: `${LOGICAL_SOURCE_ID}:schema-ref:0`,
    logical_source_id: LOGICAL_SOURCE_ID,
    qualified_name: "pdata_n.source",
    guid: "source-guid",
    status: "SUCCESS",
    source: `input-pack:${table.contentHash}`,
    metadata_qualified_name: "PDATA_N.SOURCE",
    ddl_sha256: sha256File(ddlPath),
    table_status: "ONLINE",
    required_for_star: true,
    physical_columns: ["id", "flag"],
    partition_columns: [],
  };
  options.mutateSchemaRef?.(schemaRef);
  const relationRows = legacyRelationRows(plan, options.mutateRelation);
  const fieldRows: readonly JsonRecord[] = [];
  const bindingRows: readonly JsonRecord[] = [];
  const datasetRows: readonly JsonRecord[] = [
    {
      task_id: TASK_ID,
      direction: "READ",
      dataset_id: "dataset:gate-source:pdata_n.source",
      physical_dataset: "pdata_n.source",
      provenance: "SQL_PLAN",
      resolution_status: "RESOLVED",
    },
  ];
  const relationPath = join(bundle, "relation-nodes.jsonl");
  const fieldPath = join(bundle, "field-expression-nodes.jsonl");
  const bindingPath = join(bundle, "output-field-bindings.jsonl");
  const schemaPath = join(bundle, "schema-refs.jsonl");
  const datasetPath = join(bundle, "dataset-io.jsonl");
  writeJsonl(relationPath, relationRows);
  writeJsonl(fieldPath, fieldRows);
  writeJsonl(bindingPath, bindingRows);
  writeJsonl(schemaPath, [schemaRef]);
  writeJsonl(datasetPath, datasetRows);

  const schemaSnapshot = JSON.stringify({ records: [schemaRef] }, null, 2);
  const schemaBundleSha256 = sha256Text(schemaSnapshot);
  const schemaSnapshotPath = join(
    dataRoot,
    "field-facts",
    "snapshots",
    "schema",
    `${schemaBundleSha256}.json`,
  );
  mkdirSync(join(schemaSnapshotPath, ".."), { recursive: true });
  writeFileSync(schemaSnapshotPath, schemaSnapshot, "utf8");

  const sqlSha256 = sha256File(sqlPath);
  const tableJsonPath = join(table.directory, "table.json");
  const manifest: JsonRecord = {
    schema_version: "1.3.0",
    task_id: TASK_ID,
    logical_source_id: LOGICAL_SOURCE_ID,
    status: "SUCCESS",
    inputs: {
      sql_sha256: sqlSha256,
      sql_snapshot: `snapshots/sql/${sqlSha256}.sql`,
      schema_bundle_sha256: schemaBundleSha256,
      schema_snapshot: `snapshots/schema/${schemaBundleSha256}.json`,
      analysis_config_sha256: "a".repeat(64),
      input_pack: {
        schema_version: "machine-facts-input-pack-provenance-v1",
        data_root: dataRoot,
        task_locator: relativeLocator(dataRoot, taskPath),
        task_content_hash: task.contentHash,
        sql_slot: "query",
        sql_locator: relativeLocator(dataRoot, sqlPath),
        sql_sha256: sqlSha256,
        analysis_sql_sha256: sqlSha256,
        table_locator: relativeLocator(dataRoot, tableJsonPath),
        table_content_hash: table.contentHash,
        ddl_locator: relativeLocator(dataRoot, ddlPath),
        ddl_sha256: sha256File(ddlPath),
      },
    },
    method: {
      dialect: "databricks",
      parser: { engine: "sql-static-lineage", version: "fixture" },
      adapter: { name: "machine-facts-writer", version: "fixture" },
      plan_adapter: { name: "plan-adapter", version: "fixture" },
    },
    outputs: [
      outputRecord(
        bundle,
        "relation-nodes.jsonl",
        "machine-facts-relation-nodes-v1",
        relationRows,
      ),
      outputRecord(
        bundle,
        "field-expression-nodes.jsonl",
        "machine-facts-field-expressions-v2",
        fieldRows,
      ),
      outputRecord(
        bundle,
        "output-field-bindings.jsonl",
        "machine-facts-output-field-bindings-v1",
        bindingRows,
      ),
      outputRecord(
        bundle,
        "schema-refs.jsonl",
        "machine-facts-schema-refs-v1",
        [schemaRef],
      ),
      outputRecord(
        bundle,
        "dataset-io.jsonl",
        "machine-facts-dataset-io-v1",
        datasetRows,
      ),
    ],
    counts: {
      statements: 1,
      schema_refs: 1,
      dataset_io: datasetRows.length,
      relation_nodes: relationRows.length,
      field_expression_nodes: fieldRows.length,
      output_field_bindings: bindingRows.length,
    },
    gates: { required_files: true, hash_integrity: true },
    boundaries: {
      business_logic_correctness: "NOT_EVALUATED",
      runtime_execution: "NOT_EVALUATED",
      business_rows_read: false,
      external_model_calls: 0,
      cross_task_field_stitching: "NOT_GENERATED",
    },
  };
  writeFileSync(
    join(bundle, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const sentinel = join(
    dataRoot,
    "artifacts",
    "tasks",
    TASK_ID,
    "canonical-sentinel.txt",
  );
  mkdirSync(join(sentinel, ".."), { recursive: true });
  writeFileSync(sentinel, "canonical artifact must remain untouched\n", "utf8");

  if (options.mutateDdl) {
    writeFileSync(
      ddlPath,
      "CREATE TABLE pdata_n.source (id STRING, flag STRING);",
      "utf8",
    );
  }

  return {
    parent,
    dataRoot,
    bundle,
    taskPath,
    sqlPath,
    tableDirectory: table.directory,
    ddlPath,
    plan,
    relationRows,
    schemaRef,
  };
}

function snapshotFiles(root: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile())
        result.set(relativeLocator(root, path), sha256File(path));
    }
  };
  visit(root);
  return result;
}

function relationId(plan: PlanFacts, type: PlanRelation["type"]): string {
  const relation = plan.relations.find((item) => item.type === type);
  if (!relation) throw new Error(`fixture relation missing: ${type}`);
  return globalRelationId(relation.id);
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("Machine Facts gate input", () => {
  it("restores exact DDL/schema evidence and relation/evidence line locators", () => {
    const fixture = createFixture();
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });
    const sourceTable = result.schemaProjection.schema?.tables[0];
    const readId = relationId(fixture.plan, "read");
    const filterId = relationId(fixture.plan, "filter");
    const projectId = relationId(fixture.plan, "project");
    const relationFile = relativeLocator(
      fixture.dataRoot,
      join(fixture.bundle, "relation-nodes.jsonl"),
    );
    const schemaFile = relativeLocator(
      fixture.dataRoot,
      join(fixture.bundle, "schema-refs.jsonl"),
    );
    const tableFile = relativeLocator(
      fixture.dataRoot,
      join(fixture.tableDirectory, "table.json"),
    );
    const ddlFile = relativeLocator(fixture.dataRoot, fixture.ddlPath);

    expect(result.status).toBe("SUCCESS");
    expect(result.defaultSchema).toBe("pdata_n");
    expect(result.projectionPlanSource).toBe("FINGERPRINT_MATCHED_ENRICHMENT");
    expect(
      result.schemaProjection.types.map((fact) => [
        fact.column.name,
        fact.type.name,
      ]),
    ).toEqual([
      ["id", "BIGINT"],
      ["flag", "VARCHAR"],
    ]);
    expect(sourceTable).toMatchObject({
      schema: "pdata_n",
      name: "source",
      columns: [
        { name: "id", type: "BIGINT", ordinal: 0, nullable: true },
        { name: "flag", type: "VARCHAR", ordinal: 1, nullable: true },
      ],
      evidenceRefs: [tableFile, ddlFile, `${schemaFile}#L1`],
    });
    expect(result.schemaProjection.types[0]?.evidenceRefs).toEqual([
      tableFile,
      ddlFile,
      `${schemaFile}#L1`,
    ]);
    expect(result.relationEvidenceRefs[readId]).toEqual([`${relationFile}#L1`]);
    expect(result.relationEvidenceRefs[filterId]).toEqual([
      `${relationFile}#L2`,
    ]);
    expect(result.relationEvidenceRefs[projectId]).toEqual([
      `${relationFile}#L3`,
    ]);
    expect(result.expressionEvidenceRefs[`${filterId}:predicate`]).toEqual([
      `${relationFile}#L2`,
    ]);
    expect(result.fingerprints.sqlSha256).toBe(sha256File(fixture.sqlPath));
    expect(result.fingerprints.machineFactsManifestSha256).toBe(
      sha256File(join(fixture.bundle, "manifest.json")),
    );
  });

  it("enriches legacy read occurrence and filter clause only for an exact current-plan match", () => {
    const fixture = createFixture();
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });
    const read = result.planFacts?.relations.find(
      (relation) => relation.type === "read",
    );
    const filter = result.planFacts?.relations.find(
      (relation) => relation.type === "filter",
    );

    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.enrichedRelationCount).toBe(2);
    expect(
      read && read.type === "read" ? read.read_occurrence_id : undefined,
    ).toBe(globalRelationId("root.read.s"));
    expect(filter && filter.type === "filter" ? filter.clause : undefined).toBe(
      "where",
    );
  });

  it("keeps the frozen relations when the current-plan relation id drifts", () => {
    const fixture = createFixture({
      mutateRelation: (relation) => {
        if (relation.type === "read")
          relation.id = `${String(relation.id)}:drifted`;
      },
    });
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });

    expect(result.projectionPlanSource).toBe("FROZEN_MACHINE_FACTS");
    expect(result.enrichedRelationCount).toBe(0);
    expect(result.warnings).toContain(
      `CURRENT_PLAN_RELATION_IDENTITY_DRIFT:${globalRelationId("root.read.s")}:drifted`,
    );
    expect(
      result.planFacts?.relations.find(
        (relation) => relation.type === "filter",
      ),
    )?.toMatchObject({
      clause: "legacy-clause",
    });
  });

  it("keeps the frozen relations when the current-plan relation type drifts", () => {
    const fixture = createFixture({
      mutateRelation: (relation) => {
        if (relation.type === "read") relation.type = "project";
      },
    });
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });

    expect(result.projectionPlanSource).toBe("FROZEN_MACHINE_FACTS");
    expect(result.enrichedRelationCount).toBe(0);
    expect(result.warnings).toContain(
      `CURRENT_PLAN_RELATION_IDENTITY_DRIFT:${globalRelationId("root.read.s")}`,
    );
    expect(
      result.planFacts?.relations.find(
        (relation) => relation.type === "filter",
      ),
    )?.toMatchObject({
      clause: "legacy-clause",
    });
  });

  it("keeps the frozen relations when the current-plan relation span drifts", () => {
    const fixture = createFixture({
      mutateRelation: (relation) => {
        if (relation.type !== "filter") return;
        const span = asRecord(relation.span);
        relation.span = { ...span, end: Number(span.end) + 1 };
      },
    });
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });

    expect(result.projectionPlanSource).toBe("FROZEN_MACHINE_FACTS");
    expect(result.enrichedRelationCount).toBe(0);
    expect(result.warnings).toContain(
      `CURRENT_PLAN_RELATION_IDENTITY_DRIFT:${globalRelationId("root.filter")}`,
    );
    expect(
      result.planFacts?.relations.find(
        (relation) => relation.type === "filter",
      ),
    )?.toMatchObject({
      clause: "legacy-clause",
    });
  });

  it("fails before restoring facts when the SQL fingerprint changes", () => {
    const fixture = createFixture();
    writeFileSync(
      fixture.sqlPath,
      `${SQL}\n-- changed after capture\n`,
      "utf8",
    );

    expect(() =>
      loadMachineFactsGateInput({
        dataRoot: fixture.dataRoot,
        taskId: TASK_ID,
      }),
    ).toThrow("MACHINE_FACTS_SQL_FINGERPRINT_MISMATCH");
  });

  it("exposes a conservative issue when the table-pack DDL fingerprint changes", () => {
    const fixture = createFixture({ mutateDdl: true });
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });

    expect(result.status).not.toBe("SUCCESS");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "SCHEMA_DDL_FINGERPRINT_MISMATCH:pdata_n.source",
      ]),
    );
    expect(result.schemaProjection.types).toEqual([]);
  });

  it("exposes a conservative issue when the schema identity is not an exact table-pack identity", () => {
    const fixture = createFixture({
      mutateSchemaRef: (schemaRef) => {
        schemaRef.qualified_name = "pdata_n.other_source";
      },
    });
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });

    expect(result.status).not.toBe("SUCCESS");
    expect(result.issues).toContain(
      "SCHEMA_PACK_IDENTITY_NOT_EXACT:pdata_n.other_source",
    );
    expect(result.schemaProjection.types).toEqual([]);
  });

  it("does not write canonical artifacts while loading a gate input", () => {
    const fixture = createFixture();
    const before = snapshotFiles(fixture.dataRoot);
    const result = loadMachineFactsGateInput({
      dataRoot: fixture.dataRoot,
      taskId: TASK_ID,
    });
    const after = snapshotFiles(fixture.dataRoot);

    expect(result.status).toBe("SUCCESS");
    expect([...after.entries()]).toEqual([...before.entries()]);
    expect(
      readFileSync(
        join(
          fixture.dataRoot,
          "artifacts",
          "tasks",
          TASK_ID,
          "canonical-sentinel.txt",
        ),
        "utf8",
      ),
    ).toBe("canonical artifact must remain untouched\n");
    expect(
      existsSync(
        join(
          fixture.dataRoot,
          "artifacts",
          "tasks",
          TASK_ID,
          "field-lineage.json",
        ),
      ),
    ).toBe(false);
  });
});

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  writeTableInput,
  writeTaskInput,
  type TaskEvidence,
} from "../scripts/input/input-pack.ts";
import {
  assertOutputOutsideDataRoot,
  buildTableProducerIndex,
  fingerprintTableProducerInputs,
  loadTableProducerIndex,
  lookupConfirmedProducers,
  lookupNonConfirmedRelations,
  validateTableProducerIndex,
  writeTableProducerIndex,
} from "../scripts/reconcile/producer-index.ts";

function dataRoot(): string {
  return mkdtempSync(join(tmpdir(), "sql-lineage-producer-index-"));
}

function materializeFrozenInputPack(sourceRoot: string): string {
  const root = dataRoot();
  cpSync(sourceRoot, root, { recursive: true });
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      const normalizeEvidenceFile = (relativePath: string): void => {
        const evidencePath = join(directory, relativePath);
        const normalized = readFileSync(evidencePath, "utf8").replaceAll(
          "\r\n",
          "\n",
        );
        writeFileSync(
          evidencePath,
          normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized,
        );
      };
      if (entry.name === "task.json") {
        const task = JSON.parse(readFileSync(path, "utf8")) as {
          sqlFiles?: { path: string }[];
        };
        for (const sqlFile of task.sqlFiles ?? []) {
          normalizeEvidenceFile(sqlFile.path);
        }
      }
      if (entry.name === "table.json") {
        const table = JSON.parse(readFileSync(path, "utf8")) as {
          ddlFile?: { path: string };
        };
        if (table.ddlFile) normalizeEvidenceFile(table.ddlFile.path);
      }
    }
  };
  visit(root);
  return root;
}

function writeTable(
  root: string,
  qualifiedName: string,
  dataSource = "gfhive",
): string {
  const [schema, name] = qualifiedName.split(".");
  return writeTableInput(root, {
    platform: "hive",
    dataSource,
    qualifiedName,
    schema,
    name,
    objectType: "TABLE",
    ddl: `CREATE TABLE ${qualifiedName} (id bigint)`,
    evidenceProvider: "fixture:table",
    collectedAt: "2026-08-23T00:00:00.000Z",
  }).directory;
}

function writeTask(
  root: string,
  taskId: string,
  evidence: Omit<TaskEvidence, "taskId" | "taskCategory" | "collectedAt">,
): void {
  writeTaskInput(root, {
    taskId,
    taskCategory: "hiveTask-2.0",
    collectedAt: "2026-08-23T00:00:00.000Z",
    evidenceProvider: evidence.evidenceProvider ?? "fixture:task",
    ...evidence,
  });
}

describe("table producer index", () => {
  it("indexes only confirmed writes while retaining candidates and every write observation", () => {
    const root = dataRoot();
    writeTable(root, "lake.a");
    writeTable(root, "lake.b");
    writeTask(root, "p1", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      writeMode: "OVERWRITE",
      partition: { busi_date: "${busi_date}" },
    });
    writeTask(root, "p2", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "SQL_EXACT_TABLE_TARGET",
      evidenceProvider:
        "sql-mcp:explicit-table-target+opencli:szdata.table-guid",
    });
    writeTask(root, "candidate", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
      evidenceProvider: "opencli:szdata.table-task-relation",
    });
    writeTask(root, "multi-write", {
      sql: {
        query: [
          "INSERT OVERWRITE TABLE lake.b PARTITION (busi_date='20260822') SELECT 1;",
          "INSERT INTO TABLE lake.b PARTITION (busi_date=${busi_date}) SELECT 2;",
        ].join("\n"),
      },
    });
    writeTask(root, "missing-identity", {
      sql: { query: "INSERT OVERWRITE TABLE lake.missing SELECT 1" },
    });

    const index = buildTableProducerIndex(root, {
      now: () => "2026-08-23T01:00:00.000Z",
    });
    const producers = lookupConfirmedProducers(index, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "lake.a",
    });
    const candidates = lookupNonConfirmedRelations(index, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "lake.a",
    });

    expect(producers.map((edge) => edge.taskId)).toEqual(["p1", "p2"]);
    expect(candidates.map((edge) => edge.taskId)).toEqual(["candidate"]);
    expect(candidates[0]?.directionStatus).toBe("UNKNOWN");
    expect(
      index.confirmedProducerEdges.find(
        (edge) => edge.table.qualifiedName === "lake.b",
      )?.writes,
    ).toEqual([
      expect.objectContaining({
        observationKind: "SQL_EXPLICIT_WRITE",
        sqlWriteKind: "INSERT_OVERWRITE",
        partition: [
          expect.objectContaining({
            field: "busi_date",
            observedValue: "20260822",
            valueStatus: "OBSERVED_RENDERED_VALUE",
          }),
        ],
      }),
      expect.objectContaining({
        observationKind: "SQL_EXPLICIT_WRITE",
        sqlWriteKind: "INSERT_INTO",
        partition: [
          expect.objectContaining({
            field: "busi_date",
            observedValue: null,
            valueStatus: "RUNTIME_EXPRESSION",
          }),
        ],
      }),
    ]);
    expect(index.nonConfirmedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "missing-identity",
          tableRef: expect.objectContaining({
            qualifiedName: "lake.missing",
            identityStatus: "QUALIFIED_NAME_ONLY",
          }),
          directionStatus: "WRITE_CONFIRMED",
          reasonCodes: ["SQL_WRITE_TABLE_IDENTITY_UNRESOLVED"],
        }),
      ]),
    );
    expect(index).toMatchObject({
      artifactType: "TABLE_PRODUCER_INDEX",
      buildStatus: "SUCCESS",
      coverageSemantics: "OBSERVED_EVIDENCE_ONLY",
    });
    expect(index.counts).toMatchObject({
      taskPacksDiscovered: 5,
      taskPacksIndexed: 5,
      confirmedTables: 2,
      confirmedProducerEdges: 3,
      confirmedWriteObservations: 4,
      candidateObservations: 2,
    });
  });

  it("is deterministic apart from generatedAt and changes its fingerprint with input bytes", () => {
    const root = dataRoot();
    writeTable(root, "lake.a");
    writeTask(root, "p1", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    });
    const first = buildTableProducerIndex(root, {
      now: () => "2026-08-23T01:00:00.000Z",
    });
    expect(fingerprintTableProducerInputs(root)).toBe(first.inputFingerprint);
    const taskPath = join(root, "tasks", "hiveTask-2.0", "p1", "task.json");
    const recollectedTask = JSON.parse(readFileSync(taskPath, "utf8")) as {
      collectedAt: string;
    };
    recollectedTask.collectedAt = "2026-08-24T00:00:00.000Z";
    writeFileSync(taskPath, `${JSON.stringify(recollectedTask, null, 2)}\n`);
    const second = buildTableProducerIndex(root, {
      now: () => "2026-08-23T02:00:00.000Z",
    });
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(second.contentHash).toBe(first.contentHash);

    const evidencePath = first.confirmedProducerEdges[0]?.writes
      .flatMap((item) => item.evidence)
      .find((item) => item.source === "INPUT_PACK_TASK")?.locator;
    expect(evidencePath).toBe("tasks/hiveTask-2.0/p1/task.json");
    const corruptedTask = JSON.parse(readFileSync(taskPath, "utf8")) as {
      taskName?: string;
    };
    corruptedTask.taskName = "changed-without-content-hash";
    writeFileSync(taskPath, `${JSON.stringify(corruptedTask, null, 2)}\n`);
    const changed = buildTableProducerIndex(root, {
      now: () => "2026-08-23T03:00:00.000Z",
    });
    expect(changed.inputFingerprint).not.toBe(first.inputFingerprint);
    expect(changed.contentHash).not.toBe(first.contentHash);
    expect(changed.confirmedProducerEdges).toEqual([]);
    expect(changed.buildStatus).toBe("PARTIAL");
    expect(changed.nonConfirmedRelations).toEqual([
      expect.objectContaining({
        taskId: "p1",
        reasonCodes: ["TASK_PACK_INVALID"],
      }),
    ]);
  });

  it("does not resolve an explicit SQL write through an ambiguous table name", () => {
    const root = dataRoot();
    writeTable(root, "lake.same", "source-a");
    writeTable(root, "lake.same", "source-b");
    writeTask(root, "ambiguous", {
      sql: { query: "CREATE TABLE lake.same AS SELECT 1" },
    });

    const index = buildTableProducerIndex(root);
    expect(index.confirmedProducerEdges).toEqual([]);
    expect(index.nonConfirmedRelations).toEqual([
      expect.objectContaining({
        taskId: "ambiguous",
        reasonCodes: ["SQL_WRITE_TABLE_IDENTITY_UNRESOLVED"],
        tableRef: expect.objectContaining({ identityStatus: "AMBIGUOUS" }),
      }),
    ]);
  });

  it("does not infer producers from task names or reads", () => {
    const root = dataRoot();
    writeTable(root, "lake.a");
    writeTask(root, "name-only", {
      taskName: "producer_lake.a",
      sql: { query: "SELECT * FROM lake.a" },
    });
    writeTask(root, "unknown", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
      evidenceProvider: "opencli:szdata.table-task-relation",
    });

    const index = buildTableProducerIndex(root);
    expect(index.confirmedProducerEdges).toEqual([]);
    expect(
      index.nonConfirmedRelations.map((relation) => relation.taskId),
    ).toEqual(["unknown"]);
  });

  it("fails closed when a Table Pack DDL no longer matches its hash", () => {
    const root = dataRoot();
    const tableDirectory = writeTable(root, "lake.a");
    writeTask(root, "direct", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    });
    writeTask(root, "sql", {
      sql: { query: "INSERT INTO TABLE lake.a SELECT 1" },
    });
    const ddlPath = join(tableDirectory, "ddl.sql");
    writeFileSync(ddlPath, `${readFileSync(ddlPath, "utf8")} -- changed`);

    const index = buildTableProducerIndex(root);
    expect(index.buildStatus).toBe("PARTIAL");
    expect(index.confirmedProducerEdges).toEqual([]);
    expect(index.counts.invalidTablePacks).toBe(1);
    expect(index.nonConfirmedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: "direct" }),
        expect.objectContaining({
          taskId: "sql",
          reasonCodes: ["SQL_WRITE_TABLE_IDENTITY_UNRESOLVED"],
        }),
      ]),
    );
  });

  it("rejects duplicate task identities and default data sources", () => {
    const root = dataRoot();
    writeTable(root, "lake.a");
    writeTable(root, "lake.defaulted", "default");
    for (const taskCategory of ["hiveTask-2.0", "oracle2hive"]) {
      writeTaskInput(root, {
        taskId: "duplicate",
        taskCategory,
        target: {
          platform: "hive",
          dataSource: "gfhive",
          qualifiedName: "lake.a",
        },
        targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
        evidenceProvider: "fixture:task",
        collectedAt: "2026-08-23T00:00:00.000Z",
      });
    }
    writeTask(root, "default-source", {
      target: {
        platform: "hive",
        dataSource: "default",
        qualifiedName: "lake.defaulted",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    });

    const index = buildTableProducerIndex(root);
    expect(index.buildStatus).toBe("PARTIAL");
    expect(index.confirmedProducerEdges).toEqual([]);
    expect(
      index.nonConfirmedRelations.flatMap((item) => item.reasonCodes),
    ).toEqual(
      expect.arrayContaining([
        "TASK_PACK_AMBIGUOUS",
        "DEFAULT_DATA_SOURCE_NOT_CONFIRMABLE",
      ]),
    );
    expect(
      index.nonConfirmedRelations.find(
        (item) => item.taskId === "default-source",
      ),
    ).toMatchObject({
      directionStatus: "WRITE_CONFIRMED",
      tableRef: { identityStatus: "QUALIFIED_NAME_ONLY" },
    });
  });

  it("validates and persists artifacts without weakening evidence boundaries", () => {
    const root = dataRoot();
    const tableDirectory = writeTable(root, "lake.a");
    writeTask(root, "p1", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "lake.a",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    });
    const first = buildTableProducerIndex(root, {
      now: () => "2026-08-23T01:00:00.000Z",
    });
    const output = join(dataRoot(), "producer-index.json");

    expect(() => validateTableProducerIndex(first)).not.toThrow();
    expect(writeTableProducerIndex(output, first).changed).toBe(true);
    expect(loadTableProducerIndex(output).contentHash).toBe(first.contentHash);

    const regenerated = buildTableProducerIndex(root, {
      now: () => "2026-08-24T01:00:00.000Z",
    });
    expect(regenerated.contentHash).toBe(first.contentHash);
    expect(writeTableProducerIndex(output, regenerated).changed).toBe(false);
    renameSync(output, `${output}.previous`);
    expect(loadTableProducerIndex(output).contentHash).toBe(first.contentHash);
    expect(existsSync(output)).toBe(true);
    expect(existsSync(`${output}.previous`)).toBe(false);
    writeFileSync(`${output}.previous`, `${JSON.stringify(first, null, 2)}\n`);
    expect(loadTableProducerIndex(output).contentHash).toBe(first.contentHash);
    expect(existsSync(`${output}.previous`)).toBe(false);

    const wrongCounts = {
      ...first,
      counts: { ...first.counts, confirmedProducerEdges: 99 },
    };
    expect(() => validateTableProducerIndex(wrongCounts)).toThrow(
      "counts.confirmedProducerEdges",
    );
    const promotedUnknownIdentity = {
      ...first,
      confirmedProducerEdges: first.confirmedProducerEdges.map((edge, index) =>
        index === 0
          ? { ...edge, table: { ...edge.table, dataSource: "default" } }
          : edge,
      ),
    };
    expect(() => validateTableProducerIndex(promotedUnknownIdentity)).toThrow(
      "default dataSource cannot be RESOLVED",
    );
    const defaultResolvedNonConfirmed = {
      ...first,
      nonConfirmedRelations: [
        {
          taskId: "candidate",
          taskCategory: null,
          taskContentHash: null,
          tableRef: {
            platform: "hive",
            dataSource: "default",
            qualifiedName: "lake.a",
            identityStatus: "RESOLVED",
          },
          directionStatus: "UNKNOWN",
          reasonCodes: ["CANDIDATE"],
          evidence: [],
        },
      ],
      counts: { ...first.counts, candidateObservations: 1 },
    };
    expect(() =>
      validateTableProducerIndex(defaultResolvedNonConfirmed),
    ).toThrow("default dataSource cannot be RESOLVED");
    const missingTablePackEvidence = {
      ...first,
      confirmedProducerEdges: first.confirmedProducerEdges.map((edge) => ({
        ...edge,
        writes: edge.writes.map((write) => ({
          ...write,
          evidence: write.evidence.filter(
            (item) => item.source !== "TABLE_PACK",
          ),
        })),
      })),
    };
    expect(() => validateTableProducerIndex(missingTablePackEvidence)).toThrow(
      "lacks verified Task/Table Pack evidence",
    );
    const noIndexedTaskPacks = {
      ...first,
      buildStatus: "PARTIAL",
      counts: {
        ...first.counts,
        taskPacksIndexed: 0,
        invalidTaskPacks: first.counts.taskPacksDiscovered,
      },
    };
    expect(() => validateTableProducerIndex(noIndexedTaskPacks)).toThrow(
      "confirmed tasks exceed indexed Task Packs",
    );
    const noIndexedTablePacks = {
      ...first,
      buildStatus: "PARTIAL",
      counts: {
        ...first.counts,
        tablePacksIndexed: 0,
        invalidTablePacks: first.counts.tablePacksDiscovered,
      },
    };
    expect(() => validateTableProducerIndex(noIndexedTablePacks)).toThrow(
      "confirmed tables exceed indexed Table Packs",
    );
    expect(() =>
      assertOutputOutsideDataRoot(root, join(root, "derived", "index.json")),
    ).toThrow("OUTPUT_MUST_BE_OUTSIDE_INPUT_PACK_ROOT");

    const ddlPath = join(tableDirectory, "ddl.sql");
    writeFileSync(ddlPath, `${readFileSync(ddlPath, "utf8")} -- changed`);
    const partial = buildTableProducerIndex(root);
    expect(partial.buildStatus).toBe("PARTIAL");
    expect(writeTableProducerIndex(output, partial).changed).toBe(true);
    expect(loadTableProducerIndex(output).buildStatus).toBe("PARTIAL");
  });

  it("indexes the 22 frozen local 86840 producers without using supplemental responses", () => {
    const fixtureRoot = join(
      process.cwd(),
      "tests",
      "fixtures",
      "reconcile-one-hop",
    );
    const evidence = JSON.parse(
      readFileSync(join(fixtureRoot, "86840-evidence.json"), "utf8"),
    ) as {
      horaeRows: { task_id: string }[];
      supplementalResponses: Record<string, unknown>;
    };
    const supplementalTaskIds = new Set(
      Object.keys(evidence.supplementalResponses),
    );
    const expectedLocalTaskIds = evidence.horaeRows
      .map((row) => row.task_id)
      .filter((taskId) => !supplementalTaskIds.has(taskId))
      .sort();

    const index = buildTableProducerIndex(
      materializeFrozenInputPack(join(fixtureRoot, "86840-input-pack")),
      { now: () => "2026-08-23T04:00:00.000Z" },
    );

    expect(index.buildStatus, JSON.stringify(index.issues, null, 2)).toBe(
      "SUCCESS",
    );
    expect(
      index.confirmedProducerEdges.map((edge) => edge.taskId).sort(),
    ).toEqual(expectedLocalTaskIds);
    expect(index.confirmedProducerEdges).toHaveLength(22);
    expect(
      index.confirmedProducerEdges.some((edge) =>
        supplementalTaskIds.has(edge.taskId),
      ),
    ).toBe(false);
  });
});

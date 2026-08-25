import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
  extractSqlDirectReads,
  extractSqlWrites,
  reconcileOneHopBatch,
  producerIndexPathFromArgs,
  reconcileOneHop,
  type OpenCliRunner,
} from "../scripts/reconcile/consumer/one-hop/reconcile-one-hop.ts";
import {
  buildTableProducerIndex,
  type TableProducerIndex,
} from "../scripts/reconcile/producer/producer-index.ts";

const frozen86840It = existsSync(
  join(
    import.meta.dirname,
    "fixtures",
    "reconcile-one-hop",
    "86840-input-pack",
  ),
)
  ? it
  : it.skip;

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), "sql-lineage-one-hop-"));
}

function materializeFrozenInputPack(sourceRoot: string): string {
  const dataRoot = fixtureRoot();
  cpSync(sourceRoot, dataRoot, { recursive: true });
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
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
        const task = JSON.parse(readFileSync(absolutePath, "utf8")) as {
          sqlFiles?: { path: string }[];
        };
        for (const sqlFile of task.sqlFiles ?? []) {
          normalizeEvidenceFile(sqlFile.path);
        }
      }
      if (entry.name === "table.json") {
        const table = JSON.parse(readFileSync(absolutePath, "utf8")) as {
          ddlFile?: { path: string };
        };
        if (table.ddlFile) normalizeEvidenceFile(table.ddlFile.path);
      }
    }
  };
  visit(dataRoot);
  return dataRoot;
}

function writeTable(dataRoot: string, qualifiedName: string): string {
  const [schema, name] = qualifiedName.split(".");
  return writeTableInput(dataRoot, {
    platform: "hive",
    dataSource: "gfhive",
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
  dataRoot: string,
  taskId: string,
  evidence: Omit<TaskEvidence, "taskId" | "taskCategory" | "collectedAt">,
): void {
  writeTaskInput(dataRoot, {
    taskId,
    taskCategory: "hiveTask-2.0",
    collectedAt: "2026-08-23T00:00:00.000Z",
    ...evidence,
  });
}

function writeProducerIndexFixture(options?: { partial?: boolean }): {
  dataRoot: string;
  producerIndex: TableProducerIndex;
} {
  const dataRoot = fixtureRoot();
  for (const table of ["src.shared", "mart.current", "raw.seed"])
    writeTable(dataRoot, table);

  writeTask(dataRoot, "current-indexed", {
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE mart.current SELECT id FROM src.shared",
        evidenceProvider: "fixture:sql",
      },
    },
    target: {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "mart.current",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    evidenceProvider: "fixture:task",
  });
  writeTask(dataRoot, "producer-direct", {
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE src.shared PARTITION (busi_date='2026-08-23') SELECT id FROM raw.seed",
        evidenceProvider: "fixture:sql",
      },
    },
    target: {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "src.shared",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: { busi_date: "${busi_date}" },
    evidenceProvider: "fixture:task",
  });
  writeTask(dataRoot, "producer-not-direct", {
    sql: {
      query: {
        content: "INSERT INTO src.shared SELECT id FROM raw.seed",
        evidenceProvider: "fixture:sql",
      },
    },
    target: {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "src.shared",
    },
    targetEvidenceKind: "SQL_EXACT_TABLE_TARGET",
    evidenceProvider:
      "fixture:task+sql-mcp:explicit-table-target+opencli:szdata.table-guid",
  });
  writeTask(dataRoot, "candidate-unknown", {
    target: {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "src.shared",
    },
    targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
    evidenceProvider: "fixture:table-task-relation",
  });

  if (options?.partial) {
    writeTask(dataRoot, "invalid-unrelated", {
      sql: {
        query: {
          content: "SELECT id FROM raw.seed",
          evidenceProvider: "fixture:sql",
        },
      },
      target: null,
      targetEvidenceKind: null,
      evidenceProvider: "fixture:task",
    });
    const invalidDirectory = join(
      dataRoot,
      "tasks",
      "hiveTask-2.0",
      "invalid-unrelated",
    );
    const invalidTask = JSON.parse(
      readFileSync(join(invalidDirectory, "task.json"), "utf8"),
    ) as { sqlFiles: { path: string }[] };
    const invalidPath = join(invalidDirectory, invalidTask.sqlFiles[0]!.path);
    writeFileSync(invalidPath, "SELECT changed_after_hash FROM raw.seed");
  }

  return {
    dataRoot,
    producerIndex: buildTableProducerIndex(dataRoot, {
      now: () => "2026-08-23T00:30:00.000Z",
    }),
  };
}

describe("reconcileOneHop", () => {
  it("reuses a prepared catalog and fingerprint for a batch root", () => {
    const fixture = writeProducerIndexFixture();
    const standalone = reconcileOneHop("current-indexed", {
      dataRoot: fixture.dataRoot,
      producerIndex: fixture.producerIndex,
      openCliRunner: () => [],
      now: () => "2026-08-23T00:30:00.000Z",
    });
    const [prepared] = reconcileOneHopBatch(["current-indexed"], {
      dataRoot: fixture.dataRoot,
      producerIndex: fixture.producerIndex,
      openCliRunner: () => [],
      now: () => "2026-08-23T00:30:00.000Z",
    });

    const omitVolatile = (value: typeof standalone) => {
      const { generatedAt: _generatedAt, ...stable } = value;
      return stable;
    };
    expect(omitVolatile(prepared!)).toEqual(omitVolatile(standalone));
  });

  it("qualifies a bare read with the proven Task Pack schema", () => {
    const dataRoot = fixtureRoot();
    writeTable(dataRoot, "pdata_news_n.t02_scr_base_info");
    writeTask(dataRoot, "103234", {
      taskName: "pdata_news_n.t02_tit_scr_base_info_TIT_ref_instrument_grp01",
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "pdata_news_n.t02_tit_scr_base_info",
      },
      targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
      sql: {
        query: {
          content: "SELECT b.id FROM t02_scr_base_info b",
          evidenceProvider: "fixture:sql",
        },
      },
      evidenceProvider: "fixture:table-task-relation",
    });

    const result = reconcileOneHop("103234", {
      dataRoot,
      openCliRunner: () => [],
      now: () => "2026-08-24T00:00:00.000Z",
    });

    expect(result.currentTask.directReads).toEqual([
      expect.objectContaining({
        table: {
          platform: "hive",
          dataSource: "gfhive",
          qualifiedName: "pdata_news_n.t02_scr_base_info",
          identityStatus: "RESOLVED",
        },
        sql: expect.objectContaining({
          qualifiedName: "pdata_news_n.t02_scr_base_info",
        }),
      }),
    ]);
  });

  it("extracts direct reads and partitioned writes with SQL provenance", () => {
    const sql = `
      INSERT OVERWRITE TABLE mart.output
      PARTITION (busi_date = '2026-08-23', grp_id = \${branch})
      SELECT a.id
      FROM src.a a
      JOIN src.b b ON a.id = b.id
    `;

    expect(
      extractSqlDirectReads(sql, "databricks").map(
        (item) => item.qualifiedName,
      ),
    ).toEqual(["src.a", "src.b"]);
    expect(extractSqlWrites(sql)).toEqual([
      expect.objectContaining({
        qualifiedName: "mart.output",
        writeKind: "INSERT_OVERWRITE",
        partition: [
          {
            field: "busi_date",
            expression: "'2026-08-23'",
            valueStatus: "OBSERVED_RENDERED_VALUE",
            observedValue: "2026-08-23",
          },
          {
            field: "grp_id",
            expression: "${branch}",
            valueStatus: "RUNTIME_EXPRESSION",
            observedValue: null,
          },
        ],
      }),
    ]);
  });

  it("ignores write-like comments and strings while retaining CTAS", () => {
    const sql = `
      -- INSERT OVERWRITE TABLE fake.comment SELECT 1;
      SELECT 'MERGE INTO fake.literal USING x ON 1=1';
      SELECT 'x\\' INSERT INTO fake.escaped_literal SELECT 1';
      /* INSERT INTO fake.block_comment SELECT 1; */
      CREATE TABLE mart.real_ctas AS SELECT 1 AS id;
    `;

    expect(
      extractSqlWrites(sql).map((item) => [item.writeKind, item.qualifiedName]),
    ).toEqual([["CTAS", "mart.real_ctas"]]);
  });

  it("rejects an explicit producer-index flag without a path", () => {
    expect(() => producerIndexPathFromArgs(["--producer-index"])).toThrow(
      "PRODUCER_INDEX_PATH_REQUIRED",
    );
    expect(() =>
      producerIndexPathFromArgs(["--producer-index", "--output", "out.json"]),
    ).toThrow("PRODUCER_INDEX_PATH_REQUIRED");
    expect(producerIndexPathFromArgs(["--task-id", "1"])).toBeUndefined();
  });

  it("keeps schedule and confirmed data traversal separate without promoting candidates", () => {
    const dataRoot = fixtureRoot();
    for (const table of ["src.a", "src.b", "src.c", "src.d"])
      writeTable(dataRoot, table);

    writeTask(dataRoot, "current1", {
      sql: {
        query: {
          content:
            "INSERT OVERWRITE TABLE mart.current SELECT a.id FROM src.a a JOIN src.b b ON a.id=b.id JOIN src.c c ON a.id=c.id",
          evidenceProvider: "fixture:sql",
        },
      },
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "mart.current",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      evidenceProvider: "fixture:task",
    });
    writeTask(dataRoot, "parent1", {
      sql: {
        query: {
          content: "INSERT OVERWRITE TABLE src.a SELECT id FROM raw.a",
          evidenceProvider: "fixture:sql",
        },
      },
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.a",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      partition: { busi_date: "${busi_date}", grp_id: "01" },
      evidenceProvider: "fixture:task",
    });
    writeTask(dataRoot, "parent2", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.d",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      evidenceProvider: "fixture:task",
    });
    writeTask(dataRoot, "parent3", {
      sql: {
        query: {
          content: "SELECT id FROM raw.candidate_only",
          evidenceProvider: "fixture:sql",
        },
      },
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.b",
      },
      targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
      evidenceProvider: "fixture:table-task-relation",
    });

    const calls: string[][] = [];
    const runner: OpenCliRunner = (args) => {
      calls.push([...args]);
      if (args[0] === "horae")
        return [
          { task_id: "parent1", task_name: "parent one", direction: "上游" },
          { task_id: "parent2", task_name: "parent two", direction: "上游" },
          {
            task_id: "parent3",
            task_name: "candidate only",
            direction: "上游",
          },
          { task_id: "parent4", task_name: "live parent", direction: "上游" },
        ];
      if (args[0] === "szdata" && args.includes("parent4"))
        return {
          taskId: "parent4",
          target: "src.c",
          hivePartition: "-",
          loadMode: "OVERWRITE",
          evidenceLevel: "opencli_task_source",
          status: "SUCCEEDED",
        };
      throw new Error(`unexpected command: ${args.join(" ")}`);
    };

    const result = reconcileOneHop("current1", {
      dataRoot,
      openCliRunner: runner,
      now: () => "2026-08-23T01:02:03.000Z",
    });

    expect(result.counts).toEqual({
      sqlDirectReads: 3,
      scheduleParents: 4,
      matched: 2,
      sqlOnly: 1,
      scheduleOnly: 1,
      unresolved: 1,
    });
    expect(result.countSemantics).toEqual({
      reconciliationStatusUnit: "RECONCILIATION_ITEM",
      sqlDirectReadsUnit: "NORMALIZED_DIRECT_READ_REFERENCE",
      scheduleParentsUnit: "DISTINCT_TASK",
      statusesExclusivePerItem: true,
      statusesExclusivePerPhysicalTable: false,
    });
    expect(result.coverage).toMatchObject({
      semantics: "OBSERVED_EVIDENCE_ONLY",
      directReadTables: {
        total: 3,
        identityResolved: 3,
        identityUnresolved: 0,
      },
      scheduleParents: {
        total: 4,
        taskPackAvailable: 3,
        taskPackMissing: 1,
      },
      retrieval: {
        producerIndex: "NOT_REQUESTED",
        liveTaskSourceAttempts: 1,
        liveTaskSourceSuccesses: 1,
        liveTaskSourceFailures: 0,
      },
      overlaps: {
        sqlOnlyAndUnresolvedTables: 1,
      },
    });
    expect(result.nextScheduleTaskIds).toEqual([
      "parent1",
      "parent2",
      "parent3",
      "parent4",
    ]);
    expect(result.nextDataTaskIds).toEqual(["parent1", "parent4"]);
    expect(
      result.reconciliation.map((item) => [
        item.status,
        item.taskId,
        item.table.qualifiedName,
      ]),
    ).toEqual([
      ["MATCHED", "parent1", "src.a"],
      ["SCHEDULE_ONLY", "parent2", "src.d"],
      ["UNRESOLVED", "parent3", "src.b"],
      ["MATCHED", "parent4", "src.c"],
      ["SQL_ONLY", null, "src.b"],
    ]);
    expect(
      result.parents.find((item) => item.taskId === "parent3"),
    ).toMatchObject({
      resolutionStatus: "UNRESOLVED",
      confirmedWrites: [],
      unconfirmedTargets: [
        expect.objectContaining({
          qualifiedName: "src.b",
          reason: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
        }),
      ],
    });
    const liveWrite = result.parents.find((item) => item.taskId === "parent4")
      ?.confirmedWrites[0];
    expect(liveWrite).toMatchObject({
      table: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.c",
        identityStatus: "RESOLVED",
      },
    });
    expect(
      liveWrite?.evidence.some((item) => item.source === "SZDATA_TASK_SOURCE"),
    ).toBe(true);
    expect(calls).toEqual([
      [
        "horae",
        "relation",
        "current1",
        "--direction",
        "up",
        "--depth",
        "1",
        "-f",
        "json",
      ],
      [
        "szdata",
        "task-source",
        "--task-id",
        "parent4",
        "-f",
        "json",
        "--timeout",
        "20",
      ],
    ]);
    expect(result.boundaries).toMatchObject({
      schedulerExecution: "NOT_EVALUATED",
      runtimeDelivery: "NOT_EVALUATED",
      businessCorrectness: "NOT_EVALUATED",
      producerCandidatesAreWrites: false,
    });
    expect(
      result.parents.find((item) => item.taskId === "parent1")
        ?.confirmedWrites[0]?.partition,
    ).toEqual([
      {
        field: "busi_date",
        expression: "${busi_date}",
        valueStatus: "RUNTIME_EXPRESSION",
        observedValue: null,
      },
      {
        field: "grp_id",
        expression: "01",
        valueStatus: "OBSERVED_RENDERED_VALUE",
        observedValue: "01",
      },
    ]);
  });

  it("consumes every confirmed producer for a read table without promoting non-confirmed candidates", () => {
    const { dataRoot, producerIndex } = writeProducerIndexFixture();
    expect(producerIndex.buildStatus).toBe("SUCCESS");
    const calls: string[][] = [];
    const runner: OpenCliRunner = (args) => {
      calls.push([...args]);
      if (args[0] === "horae")
        return [
          {
            task_id: "producer-direct",
            task_name: "direct producer",
            direction: "上游",
          },
        ];
      throw new Error(`task-source must not be called: ${args.join(" ")}`);
    };

    const result = reconcileOneHop("current-indexed", {
      dataRoot,
      producerIndex,
      openCliRunner: runner,
      now: () => "2026-08-23T01:02:03.000Z",
    });

    expect(result.producerIndex).toMatchObject({
      status: "VALID_SUCCESS",
      inputFingerprint: producerIndex.inputFingerprint,
      contentHash: producerIndex.contentHash,
    });
    expect(result.dataPath.confirmedProducers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "producer-direct",
          scheduleRelation: "DIRECT_PARENT",
          table: expect.objectContaining({ qualifiedName: "src.shared" }),
        }),
        expect.objectContaining({
          taskId: "producer-not-direct",
          scheduleRelation: "NOT_DIRECT_PARENT",
          table: expect.objectContaining({ qualifiedName: "src.shared" }),
        }),
      ]),
    );
    expect(result.dataPath.confirmedProducers).toHaveLength(2);
    expect(result.nextDataTaskIds).toEqual([
      "producer-direct",
      "producer-not-direct",
    ]);
    expect(result.nextDataTaskIds).not.toContain("candidate-unknown");
    expect(calls).toEqual([
      [
        "horae",
        "relation",
        "current-indexed",
        "--direction",
        "up",
        "--depth",
        "1",
        "-f",
        "json",
      ],
    ]);

    // Reconciliation counts remain observation/item counts. Discovering another
    // producer for the same physical table must not rewrite the schedule result.
    expect(result.counts).toMatchObject({
      sqlDirectReads: 1,
      scheduleParents: 1,
      matched: 1,
      sqlOnly: 0,
      unresolved: 0,
    });
    expect(result.coverage).toMatchObject({
      semantics: "OBSERVED_EVIDENCE_ONLY",
      directReadTables: {
        total: 1,
        identityResolved: 1,
        identityUnresolved: 0,
        withConfirmedProducer: 1,
        withNonConfirmedOnly: 0,
        withNoProducerObservation: 0,
      },
      producerEvidenceObservations: {
        confirmedProducerEdges: 2,
        confirmedWriteObservations: 4,
        nonConfirmedRelationObservations: 1,
        directionConfirmed: 4,
        directionUnknown: 1,
        identityResolved: 5,
        identityUnresolved: 0,
      },
      retrieval: {
        producerIndex: "VALID_SUCCESS",
        liveTaskSourceAttempts: 0,
        liveTaskSourceSuccesses: 0,
        liveTaskSourceFailures: 0,
      },
      overlaps: {
        confirmedAndNonConfirmedTables: 1,
      },
    });
  });

  it("keeps mutation-only writes on the schedule path but out of data traversal", () => {
    const dataRoot = fixtureRoot();
    writeTable(dataRoot, "src.mutated");
    writeTable(dataRoot, "mart.current");
    writeTask(dataRoot, "current-mutation", {
      sql: {
        query: {
          content: "SELECT id FROM src.mutated",
          evidenceProvider: "fixture:sql",
        },
      },
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "mart.current",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      evidenceProvider: "fixture:task",
    });
    writeTask(dataRoot, "mutation-parent", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.mutated",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      writeMode: "truncate",
      sql: { truncate: "TRUNCATE TABLE src.mutated" },
      evidenceProvider: "fixture:task",
    });
    const producerIndex = buildTableProducerIndex(dataRoot);
    const result = reconcileOneHop("current-mutation", {
      dataRoot,
      producerIndex,
      openCliRunner: (args) =>
        args[0] === "horae"
          ? [{ task_id: "mutation-parent", direction: "上游" }]
          : null,
    });
    expect(result.nextScheduleTaskIds).toEqual(["mutation-parent"]);
    expect(result.nextDataTaskIds).toEqual([]);
    expect(result.dataPath.confirmedProducers).toEqual([]);
    expect(result.reconciliation).toEqual([
      expect.objectContaining({
        status: "MATCHED",
        taskId: "mutation-parent",
        table: expect.objectContaining({ qualifiedName: "src.mutated" }),
      }),
    ]);
  });

  it("fails closed before Horae or task-source when an explicit producer index is stale or invalid", () => {
    const staleFixture = writeProducerIndexFixture();
    writeTable(staleFixture.dataRoot, "src.added_after_index");
    const calls: string[][] = [];
    const runner: OpenCliRunner = (args) => {
      calls.push([...args]);
      return [];
    };

    expect(() =>
      reconcileOneHop("current-indexed", {
        dataRoot: staleFixture.dataRoot,
        producerIndex: staleFixture.producerIndex,
        openCliRunner: runner,
      }),
    ).toThrow(/producer index.*fingerprint|fingerprint.*producer index/i);
    expect(calls).toEqual([]);

    const invalidFixture = writeProducerIndexFixture();
    const invalidIndex = {
      ...invalidFixture.producerIndex,
      contentHash: "0".repeat(64),
    } as TableProducerIndex;
    expect(() =>
      reconcileOneHop("current-indexed", {
        dataRoot: invalidFixture.dataRoot,
        producerIndex: invalidIndex,
        openCliRunner: runner,
      }),
    ).toThrow(/producer index.*contentHash|contentHash.*producer index/i);
    expect(calls).toEqual([]);
  });

  it("consumes confirmed edges from a valid PARTIAL index while preserving its observed-evidence boundary", () => {
    const { dataRoot, producerIndex } = writeProducerIndexFixture({
      partial: true,
    });
    expect(producerIndex.buildStatus).toBe("PARTIAL");
    const calls: string[][] = [];
    const runner: OpenCliRunner = (args) => {
      calls.push([...args]);
      if (args[0] === "horae")
        return [
          {
            task_id: "producer-direct",
            task_name: "direct producer",
            direction: "上游",
          },
        ];
      throw new Error(`task-source must not be called: ${args.join(" ")}`);
    };

    const result = reconcileOneHop("current-indexed", {
      dataRoot,
      producerIndex,
      openCliRunner: runner,
    });

    expect(result.producerIndex.status).toBe("VALID_PARTIAL");
    expect(result.coverage).toMatchObject({
      semantics: "OBSERVED_EVIDENCE_ONLY",
      retrieval: {
        producerIndex: "VALID_PARTIAL",
        liveTaskSourceAttempts: 0,
        liveTaskSourceSuccesses: 0,
        liveTaskSourceFailures: 0,
      },
    });
    expect(result.nextDataTaskIds).toEqual([
      "producer-direct",
      "producer-not-direct",
    ]);
    expect(result.nextDataTaskIds).not.toContain("candidate-unknown");
    expect(result.boundaries).toMatchObject({
      staticSqlOnly: true,
      schedulerExecution: "NOT_EVALUATED",
      runtimeDelivery: "NOT_EVALUATED",
      businessCorrectness: "NOT_EVALUATED",
      producerCandidatesAreWrites: false,
      partitionScope: "TASK_TO_TABLE_WRITE",
    });
    expect(calls.every((args) => args[0] !== "szdata")).toBe(true);
  });

  it("does not let a related invalid Table Pack enter MATCHED in index mode", () => {
    const dataRoot = fixtureRoot();
    const tableDirectory = writeTable(dataRoot, "src.invalid_ddl");
    writeTask(dataRoot, "current-invalid-ddl", {
      sql: {
        query: {
          content: "SELECT id FROM src.invalid_ddl",
          evidenceProvider: "fixture:sql",
        },
      },
      evidenceProvider: "fixture:task",
    });
    writeTask(dataRoot, "producer-invalid-ddl", {
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: "src.invalid_ddl",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      evidenceProvider: "fixture:task",
    });
    const ddlPath = join(tableDirectory, "ddl.sql");
    writeFileSync(ddlPath, `${readFileSync(ddlPath, "utf8")} -- tampered`);
    const producerIndex = buildTableProducerIndex(dataRoot);
    expect(producerIndex.buildStatus).toBe("PARTIAL");
    expect(producerIndex.confirmedProducerEdges).toEqual([]);

    const calls: string[][] = [];
    const result = reconcileOneHop("current-invalid-ddl", {
      dataRoot,
      producerIndex,
      openCliRunner: (args) => {
        calls.push([...args]);
        if (args[0] === "horae")
          return [{ task_id: "producer-invalid-ddl", direction: "上游" }];
        throw new Error(`task-source must not be called: ${args.join(" ")}`);
      },
    });

    expect(result.counts).toMatchObject({
      matched: 0,
      sqlOnly: 1,
      unresolved: 1,
    });
    expect(result.reconciliation.map((item) => item.status)).toEqual([
      "UNRESOLVED",
      "SQL_ONLY",
    ]);
    expect(result.dataPath.confirmedProducers).toEqual([]);
    expect(result.dataPath.nonConfirmedRelations).toEqual([
      expect.objectContaining({
        taskId: "producer-invalid-ddl",
        directionStatus: "WRITE_CONFIRMED",
      }),
    ]);
    expect(result.nextDataTaskIds).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  frozen86840It("replays the frozen real 86840 Input Pack through 22 local and 4 supplemental parents", () => {
      const fixture = JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            "tests",
            "fixtures",
            "reconcile-one-hop",
            "86840-evidence.json",
          ),
          "utf8",
        ),
      ) as {
        taskId: string;
        frozenFrom: {
          currentTaskContentHash: string;
          querySha256: string;
        };
        expected: {
          sqlDirectReads: number;
          scheduleParents: number;
          matched: number;
          sqlOnly: number;
          scheduleOnly: number;
          unresolved: number;
          sqlOnlyQualifiedName: string;
        };
        horaeRows: Record<string, unknown>[];
        supplementalResponses: Record<string, Record<string, unknown>>;
      };
      const frozenInputPackRoot = join(
        process.cwd(),
        "tests",
        "fixtures",
        "reconcile-one-hop",
        "86840-input-pack",
      );
      const dataRoot = materializeFrozenInputPack(frozenInputPackRoot);
      const currentTask = JSON.parse(
        readFileSync(
          join(dataRoot, "tasks", "hiveTask-2.0", "86840", "task.json"),
          "utf8",
        ),
      ) as {
        contentHash: string;
        sqlFiles: { slot: string; sha256: string }[];
      };
      expect(currentTask.contentHash).toBe(
        fixture.frozenFrom.currentTaskContentHash,
      );
      expect(
        currentTask.sqlFiles.find((file) => file.slot === "query")?.sha256,
      ).toBe(fixture.frozenFrom.querySha256);
      const runner: OpenCliRunner = (args) => {
        if (args[0] === "horae") return fixture.horaeRows;
        const parentTaskId = args[args.indexOf("--task-id") + 1]!;
        const response = fixture.supplementalResponses[parentTaskId];
      if (!response) throw new Error(`UNEXPECTED_TASK_SOURCE:${parentTaskId}`);
        return response;
      };

      const result = reconcileOneHop(fixture.taskId, {
        dataRoot,
        openCliRunner: runner,
        now: () => "2026-08-22T02:58:38.275Z",
      });

      const { sqlOnlyQualifiedName, ...expectedCounts } = fixture.expected;
      expect(result.counts).toEqual(expectedCounts);
      expect(
        result.reconciliation.filter((item) => item.status === "SQL_ONLY"),
      ).toEqual([
        expect.objectContaining({
          taskId: null,
          table: expect.objectContaining({
            qualifiedName: sqlOnlyQualifiedName,
          }),
        }),
      ]);
      expect(result.nextScheduleTaskIds).toHaveLength(
        fixture.expected.scheduleParents,
      );
      expect(result.nextDataTaskIds).toHaveLength(fixture.expected.matched);
      expect(result.currentTask.directReads[0]?.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "INPUT_PACK_SQL",
            provider: "sql-mcp",
          }),
        ]),
      );
      expect(
        result.parents.find((parent) => parent.taskId === "102845")
          ?.confirmedWrites[0]?.evidence,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "INPUT_PACK_TASK",
            provider: expect.stringContaining("opencli:szdata.task-source"),
          }),
        ]),
      );

      const producerIndex = buildTableProducerIndex(dataRoot, {
        now: () => "2026-08-22T02:58:38.275Z",
      });
      expect(producerIndex.buildStatus).toBe("SUCCESS");
      const indexedCalls: string[][] = [];
      const indexedResult = reconcileOneHop(fixture.taskId, {
        dataRoot,
        producerIndex,
        openCliRunner: (args) => {
          indexedCalls.push([...args]);
          if (args[0] === "horae") return fixture.horaeRows;
          throw new Error(`INDEX_MODE_MUST_NOT_CALL:${args.join(" ")}`);
        },
        now: () => "2026-08-22T02:58:38.275Z",
      });
      expect(indexedResult.counts).toEqual({
        sqlDirectReads: 27,
        scheduleParents: 26,
        matched: 22,
        sqlOnly: 5,
        scheduleOnly: 0,
        unresolved: 4,
      });
      expect(indexedResult.producerIndex.status).toBe("VALID_SUCCESS");
      expect(indexedResult.dataPath.confirmedProducers).toHaveLength(22);
      expect(indexedResult.nextDataTaskIds).toHaveLength(22);
      expect(indexedResult.coverage.retrieval).toEqual({
        producerIndex: "VALID_SUCCESS",
        liveTaskSourceAttempts: 0,
        liveTaskSourceSuccesses: 0,
        liveTaskSourceFailures: 0,
      });
      expect(indexedCalls).toHaveLength(1);
  });
});

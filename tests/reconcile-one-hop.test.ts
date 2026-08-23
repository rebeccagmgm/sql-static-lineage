import {
  cpSync,
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
  reconcileOneHop,
  type OpenCliRunner,
} from "../scripts/reconcile/reconcile-one-hop.ts";

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
      if (entry.name !== "task.json") continue;
      const task = JSON.parse(readFileSync(absolutePath, "utf8")) as {
        sqlFiles?: { path: string }[];
      };
      for (const sqlFile of task.sqlFiles ?? []) {
        const sqlPath = join(directory, sqlFile.path);
        const bytes = readFileSync(sqlPath);
        if (bytes.at(-1) === 0x0a)
          writeFileSync(sqlPath, bytes.subarray(0, -1));
      }
    }
  };
  visit(join(dataRoot, "tasks"));
  return dataRoot;
}

function writeTable(dataRoot: string, qualifiedName: string): void {
  const [schema, name] = qualifiedName.split(".");
  writeTableInput(dataRoot, {
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName,
    schema,
    name,
    objectType: "TABLE",
    ddl: `CREATE TABLE ${qualifiedName} (id bigint)`,
    evidenceProvider: "fixture:table",
    collectedAt: "2026-08-23T00:00:00.000Z",
  });
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

describe("reconcileOneHop", () => {
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

  it("replays the frozen real 86840 Input Pack through 22 local and 4 supplemental parents", () => {
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
  });
});

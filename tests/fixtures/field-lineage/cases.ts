import { writeFileSync } from "node:fs";

import {
  writeTableInput,
  writeTaskInput,
} from "../../../scripts/input/shared/input-pack.ts";

export function createSyntheticFieldLineageInputPack(
  dataRoot: string,
  options: { readonly rootTaskName?: string } = {},
): void {
  for (const table of [
    { qualifiedName: "demo.root", columns: "out_a STRING, out_b STRING" },
    { qualifiedName: "demo.mid", columns: "mid_a STRING, filter_key STRING" },
    {
      qualifiedName: "demo.source",
      columns: "src_a STRING, filter_key STRING",
    },
    { qualifiedName: "demo.extra", columns: "src_a STRING" },
    {
      qualifiedName: "demo.partitioned",
      columns: "value_col STRING, p STRING",
      partitionFields: ["p"],
    },
  ]) {
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: table.qualifiedName,
      objectType: "hive_table",
      partitionFields: "partitionFields" in table ? table.partitionFields : [],
      ddl: `CREATE TABLE ${table.qualifiedName} (${table.columns});`,
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  writeTaskInput(dataRoot, {
    taskId: "100",
    taskCategory: "sparkIndex",
    taskName: options.rootTaskName ?? "demo.root.task",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      create: {
        content: "CREATE TABLE demo.root (out_a STRING, out_b STRING);",
        evidenceProvider: "synthetic:test",
      },
      query: {
        content:
          "SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM mid m WHERE m.filter_key <> 'X';",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "200",
    taskCategory: "hiveTask",
    taskName: "demo.mid.task",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.mid",
    },
    targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
    partition: null,
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE demo.mid SELECT s.src_a, s.filter_key FROM demo.source s;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test,opencli:szdata.table-task-relation",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "300",
    taskCategory: "sparkIndex",
    taskName: "demo.source.task",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.source",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content: "SELECT m.mid_a AS src_a, m.filter_key FROM demo.mid m;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "400",
    taskCategory: "sparkIndex",
    taskName: "demo.source.additional",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.source",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content: "SELECT e.src_a, e.src_a AS filter_key FROM demo.extra e;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "600",
    taskCategory: "sparkIndex",
    taskName: "ambiguous.slots",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      create: {
        content: "SELECT src_a AS out_a, src_a AS out_b FROM demo.extra;",
        evidenceProvider: "synthetic:test",
      },
      prepare: {
        content: "SELECT src_a AS out_a, src_a AS out_b FROM demo.extra;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "700",
    taskCategory: "sparkIndex",
    taskName: "missing.source.schema",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content:
          "SELECT x.missing_value AS out_a, x.other_value AS out_b FROM demo.not_packed x;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "800",
    taskCategory: "hiveTask",
    taskName: "dynamic.partition.union",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.partitioned",
    },
    targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
    partition: [{ p: "A" }, { p: "B" }],
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE demo.partitioned PARTITION(p) SELECT src_a, 'A' AS p FROM demo.extra UNION ALL SELECT src_a, 'B' AS p FROM demo.extra;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test,opencli:szdata.table-task-relation",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "900",
    taskCategory: "hiveTask",
    taskName: "multiple.output.writes",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
    },
    targetEvidenceKind: "TABLE_TASK_RELATION_DIRECTION_UNKNOWN",
    partition: null,
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE demo.root SELECT src_a, src_a FROM demo.extra; INSERT OVERWRITE TABLE demo.root SELECT src_a, src_a FROM demo.extra;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test,opencli:szdata.table-task-relation",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeTaskInput(dataRoot, {
    taskId: "1000",
    taskCategory: "sparkIndex",
    taskName: "multi.slot.ctas",
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      create: {
        content:
          "CREATE TABLE temp.local_stage AS SELECT src_a AS mid_a FROM demo.extra; CREATE TABLE temp.mid_stage AS SELECT mid_a AS out_a FROM temp.local_stage;",
        evidenceProvider: "synthetic:test",
      },
      query: {
        content: "SELECT out_a, out_a AS out_b FROM temp.mid_stage;",
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  writeFileSync(
    `${dataRoot}.input-pack-status.json`,
    JSON.stringify({
      schemaVersion: "1.0.0",
      dataRoot,
      tasks: {
        "500": {
          taskId: "500",
          status: "EXCLUDED",
          exclusionReason: "PHYSICAL_TABLE_NOT_FOUND",
        },
      },
    }),
    "utf8",
  );
}

export function syntheticTableLineage() {
  const table = { platform: "hive", dataSource: "warehouse" };
  return {
    schemaVersion: "1.0.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: "100",
    generatedAt: "2026-01-01T00:00:00.000Z",
    taskNodes: [
      {
        taskId: "100",
        upstreamDecision: { primary: ["200"], additional: [], unknown: [] },
      },
      {
        taskId: "200",
        upstreamDecision: {
          primary: ["300", "500"],
          additional: ["400"],
          unknown: [],
        },
      },
      {
        taskId: "300",
        upstreamDecision: { primary: ["200"], additional: [], unknown: [] },
      },
      {
        taskId: "400",
        upstreamDecision: { primary: [], additional: [], unknown: [] },
      },
    ],
    producerBridges: [
      {
        consumerTaskId: "100",
        producerTaskId: "200",
        table: { ...table, qualifiedName: "demo.mid" },
      },
      {
        consumerTaskId: "200",
        producerTaskId: "300",
        table: { ...table, qualifiedName: "demo.source" },
      },
      {
        consumerTaskId: "200",
        producerTaskId: "400",
        table: { ...table, qualifiedName: "demo.source" },
      },
      {
        consumerTaskId: "200",
        producerTaskId: "500",
        table: { ...table, qualifiedName: "demo.source" },
      },
      {
        consumerTaskId: "300",
        producerTaskId: "200",
        table: { ...table, qualifiedName: "demo.mid" },
      },
    ],
  };
}

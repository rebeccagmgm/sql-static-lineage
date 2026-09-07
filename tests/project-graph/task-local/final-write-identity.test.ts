import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeTableInput, writeTaskInput } from "../../../scripts/input/shared/input-pack.ts";
import { runInputPackMachineFacts } from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { projectTaskLocal } from "../../../scripts/project-graph/task-local/project-task-local.ts";
import { loadCurrentTaskBundle } from "../../../scripts/query/current-task-bundle.ts";

function scenario(options: {
  readonly readDataset: string;
  readonly taskName?: string;
  readonly ambiguousSecondarySource?: boolean;
  readonly missingStatementIndex?: number;
}) {
  const parent = mkdtempSync(join(tmpdir(), "task-local-final-write-identity-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  const taskId = "final-write-identity";
  for (const table of [
    { qualifiedName: "demo.result", dataSource: "warehouse" },
    { qualifiedName: "demo.source", dataSource: "warehouse" },
    { qualifiedName: "demo.secondary", dataSource: "warehouse" },
    { qualifiedName: "archive.secondary", dataSource: "archive_warehouse" },
    ...(options.ambiguousSecondarySource
      ? [{ qualifiedName: "demo.secondary", dataSource: "other_warehouse" }]
      : []),
  ]) {
    writeTableInput(dataRoot, {
      ...table,
      platform: "hive",
      objectType: "hive_table",
      partitionFields: [],
      ddl: `CREATE TABLE ${table.qualifiedName} (amount STRING);`,
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  writeTaskInput(dataRoot, {
    taskId,
    taskCategory: "hiveTask",
    taskName: options.taskName ?? "demo.final_write_identity",
    target: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.result" },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content:
          "INSERT OVERWRITE TABLE demo.secondary SELECT amount FROM demo.source; "
          + `INSERT OVERWRITE TABLE demo.result SELECT amount FROM ${options.readDataset};`,
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
  const facts = runInputPackMachineFacts({ dataRoot, taskIds: [taskId], outputRoot: factsRoot });
  expect(facts.tasks[0]?.state).toBe("SUCCESS");
  const currentBundle = loadCurrentTaskBundle(factsRoot, taskId);
  expect(currentBundle.issues).toEqual([]);
  const projection = projectTaskLocal({
    dataRoot,
    factsRoot,
    taskId,
    generatedAt: "2026-01-01T00:00:00.000Z",
    currentBundle: options.missingStatementIndex === undefined ? currentBundle : {
      ...currentBundle,
      records: {
        ...currentBundle.records,
        "statements.jsonl": currentBundle.records["statements.jsonl"]!.map((statement) =>
          statement.statement_index === options.missingStatementIndex
            ? { ...statement, statement_index: null }
            : statement,
        ),
      },
    },
  });
  expect(projection.coverageStatus).toBe("PROJECTED");
  return projection;
}

describe("task-local final-write identity", () => {
  it("does not merge same-tail tables in different schemas and physical sources", () => {
    const projection = scenario({ readDataset: "archive.secondary" });
    expect(projection.localClosure?.finalWrites.map((write) => ({
      qualifiedName: write.qualifiedName,
      outputQualification: write.outputQualification,
    }))).toEqual([
      { qualifiedName: "demo.secondary", outputQualification: "SQL_UNCONSUMED" },
      { qualifiedName: "demo.result", outputQualification: "PLATFORM_TARGET" },
    ]);
    const datasets = projection.nodes.filter((node) =>
      node.nodeType === "PHYSICAL_DATASET"
      && ["demo.secondary", "archive.secondary"].includes(String(node.properties.qualifiedName)),
    );
    expect(datasets).toHaveLength(2);
    expect(new Set(datasets.map((node) => node.nodeId)).size).toBe(2);
    expect(datasets.map((node) => node.properties.dataSource).sort()).toEqual(["archive_warehouse", "warehouse"]);
  });

  it("does not qualify a secondary write whose full name has multiple physical sources", () => {
    const projection = scenario({ readDataset: "archive.secondary", ambiguousSecondarySource: true });
    expect(projection.localClosure?.finalWrites.map((write) => write.qualifiedName)).toEqual(["demo.result"]);
    expect(projection.nodes.find((node) =>
      node.nodeType === "PHYSICAL_DATASET" && node.properties.qualifiedName === "demo.secondary",
    )?.properties).toMatchObject({
      identityStatus: "CANDIDATE_DATASET",
      identityReasonCode: "TABLE_IDENTITY_AMBIGUOUS",
    });
  });

  it("does not claim unconsumed output or bind a bare read when its schema is unresolved", () => {
    const projection = scenario({ readDataset: "secondary", taskName: "conflicting.final_write_identity" });
    expect(projection.localClosure?.finalWrites.map((write) => write.qualifiedName)).toEqual(["demo.result"]);
    expect(projection.nodes.find((node) => node.nodeType === "READ_OCCURRENCE"
      && node.properties.physicalDataset === "secondary")?.properties).toMatchObject({
      identityStatus: "CANDIDATE_DATASET",
      identityReasonCode: "TABLE_QUALIFICATION_UNRESOLVED",
      readDisposition: "EXTERNAL_READ",
    });
  });

  it.each([0, 1])("does not claim unconsumed output when statement %s has no order evidence", (missingStatementIndex) => {
    const projection = scenario({ readDataset: "demo.secondary", missingStatementIndex });
    expect(projection.localClosure?.finalWrites.map((write) => write.qualifiedName)).toEqual(["demo.result"]);
  });
});

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  writeTaskInput,
  sha256Text,
} from "../../scripts/input/shared/input-pack.ts";
import {
  prepareInputPackTask,
  runInputPackMachineFacts,
} from "../../scripts/machine-facts/input-pack-machine-facts.ts";
import { buildRealProviderInput } from "../../scripts/calcite-semantic-provider/real-input.ts";
import { createSyntheticFieldLineageInputPack } from "../fixtures/field-lineage/cases.ts";

function fixture(): string {
  const dataRoot = join(
    mkdtempSync(join(tmpdir(), "calcite-provider-input-")),
    "data",
  );
  createSyntheticFieldLineageInputPack(dataRoot);
  return dataRoot;
}

function jsonl(path: string): Record<string, unknown>[] {
  const value = readFileSync(path, "utf8").trim();
  return value ? value.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function publishRootEvidence(input: {
  readonly dataRoot: string;
  readonly taskId: string;
  readonly statementId: string;
  readonly syntheticWriteObservationId?: string;
}): void {
  const factsRoot = join(input.dataRoot, "field-facts");
  const result = runInputPackMachineFacts({
    dataRoot: input.dataRoot,
    taskIds: [input.taskId],
    outputRoot: factsRoot,
  });
  expect(result.tasks[0]?.state).toBe("SUCCESS");
  const bindingsPath = join(
    factsRoot,
    "registry",
    "tasks",
    input.taskId,
    "bundle",
    "output-field-bindings.jsonl",
  );
  let bindings = jsonl(bindingsPath).filter(
    (item) => item.statement_id === input.statementId,
  );
  if (bindings.length === 0 && input.syntheticWriteObservationId) {
    bindings = [
      {
        task_id: input.taskId,
        statement_id: input.statementId,
        write_observation_id: input.syntheticWriteObservationId,
      },
    ];
    writeFileSync(
      bindingsPath,
      `${bindings.map((binding) => JSON.stringify(binding)).join("\n")}\n`,
      "utf8",
    );
  }
  const writeIds = [
    ...new Set(
      bindings
        .map((item) => item.write_observation_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  expect(writeIds).toHaveLength(1);
  const artifactDirectory = join(
    input.dataRoot,
    "artifacts",
    "tasks",
    input.taskId,
  );
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(
    join(artifactDirectory, "field-lineage.json"),
    JSON.stringify({
      request: { rootWriteObservationIds: writeIds },
    }),
    "utf8",
  );
}

describe("Calcite real-input preparation", () => {
  it("reuses the verified Input Pack SQL, schema and source identity", () => {
    const dataRoot = fixture();
    publishRootEvidence({
      dataRoot,
      taskId: "100",
      statementId: "task:100:slot:query:statement:0",
    });
    const native = prepareInputPackTask({ dataRoot, taskId: "100" });
    const source = native.sqlSources[0]!;

    const prepared = buildRealProviderInput({ dataRoot, taskId: "100" });

    expect(prepared.dialectTransform.sourceSha256).toBe(
      prepared.evidence.sqlSha256,
    );
    expect(prepared.evidence.sqlPath).toBe(source.path);
    expect(prepared.evidence.sqlLocator).toBe(
      `${source.locator}#task:100:slot:query:statement:0`,
    );
    expect(prepared.evidence.schemaBundleSha256).toBe(native.schemaBundleHash);
    expect(prepared.request.sqlSourceId).toBe(
      "task:100:slot:query:statement:0",
    );
    expect(
      prepared.request.schema.tables
        .map((table) => `${table.schema}.${table.name}`)
        .sort(),
    ).toEqual(
      (native.schemaBundle.records as { qualified_name: string }[])
        .map((record) => record.qualified_name)
        .sort(),
    );
    expect(prepared.evidence).not.toHaveProperty("schemaSnapshotPath");
  });

  it("selects the exact target statement when another SQL slot is also field-producing", () => {
    const dataRoot = fixture();
    const query =
      "SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM demo.mid m";
    writeTaskInput(dataRoot, {
      taskId: "1100",
      taskCategory: "sparkIndex",
      taskName: "demo.multi-source.task",
      target: {
        platform: "hive",
        dataSource: "warehouse",
        qualifiedName: "demo.root",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      partition: null,
      sql: {
        query: { content: query, evidenceProvider: "synthetic:test" },
        finish: {
          content:
            "SELECT e.src_a AS out_a, e.src_a AS out_b FROM demo.extra e",
          evidenceProvider: "synthetic:test",
        },
      },
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
    const statementId = "task:1100:slot:query:statement:0";
    publishRootEvidence({
      dataRoot,
      taskId: "1100",
      statementId,
      syntheticWriteObservationId: "write-observation:1100:query:0",
    });

    const prepared = buildRealProviderInput({ dataRoot, taskId: "1100" });

    expect(prepared.request.sqlSourceId).toBe(statementId);
    expect(prepared.request.statementOrdinal).toBe(0);
    expect(prepared.dialectTransform.sourceSha256).toBe(sha256Text(query));
    expect(prepared.evidence.sqlSha256).toBe(sha256Text(query));
    expect(prepared.evidence.sqlLocator).toContain("slot:query");
  });

  it("fails closed when the target statement cannot be found exactly in its SQL slot", () => {
    const dataRoot = fixture();
    const query =
      "SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM demo.mid m";
    writeTaskInput(dataRoot, {
      taskId: "1101",
      taskCategory: "sparkIndex",
      taskName: "demo.statement-mismatch.task",
      target: {
        platform: "hive",
        dataSource: "warehouse",
        qualifiedName: "demo.root",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      partition: null,
      sql: { query: { content: query, evidenceProvider: "synthetic:test" } },
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
    const statementId = "task:1101:slot:query:statement:0";
    publishRootEvidence({ dataRoot, taskId: "1101", statementId });
    const statementsPath = join(
      dataRoot,
      "field-facts",
      "registry",
      "tasks",
      "1101",
      "bundle",
      "statements.jsonl",
    );
    const statements = jsonl(statementsPath).map((statement) =>
      statement.statement_id === statementId
        ? { ...statement, raw_sql: "SELECT impossible_source FROM nowhere" }
        : statement,
    );
    writeFileSync(
      statementsPath,
      `${statements.map((statement) => JSON.stringify(statement)).join("\n")}\n`,
      "utf8",
    );

    expect(() => buildRealProviderInput({ dataRoot, taskId: "1101" })).toThrow(
      "CALCITE_ROOT_STATEMENT_NOT_UNIQUE_IN_SOURCE",
    );
  });
});

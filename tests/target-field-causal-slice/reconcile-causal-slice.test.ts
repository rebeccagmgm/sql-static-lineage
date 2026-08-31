import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as inputPackMachineFacts from "../../scripts/machine-facts/input-pack-machine-facts.ts";
import * as producerIndex from "../../scripts/reconcile/producer/producer-index.ts";
import * as oldFieldLineage from "../../scripts/reconcile/consumer/field-lineage/field-lineage.ts";
import { writeTaskInput } from "../../scripts/input/shared/input-pack.ts";
import { reconcileMultiHop } from "../../scripts/reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import {
  reconcileTargetFieldCausalSlice,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/reconcile-causal-slice.ts";
import { parseTargetFieldCausalSliceCli } from "../../scripts/reconcile/consumer/target-field-causal-slice/reconcile-target-field-causal-slice.ts";

const roots: string[] = [];

function fixture(): { dataRoot: string; factsRoot: string; producerIndex: string; tableMultiHop: string; producerPath: string; tablePath: string; taskDirectory: string } {
  const root = mkdtempSync(join(tmpdir(), "causal-slice-read-only-"));
  roots.push(root);
  const dataRoot = join(root, "input");
  const factsRoot = join(root, "facts");
  mkdirSync(join(dataRoot, "tasks"), { recursive: true });
  mkdirSync(join(dataRoot, "tables"), { recursive: true });
  mkdirSync(factsRoot, { recursive: true });
  const producerPath = join(root, "producer-index.json");
  const tablePath = join(root, "table-multi-hop.json");
  const task = writeTaskInput(dataRoot, {
    taskId: "task-1",
    taskCategory: "sparkIndex",
    sql: { query: "select 1 as amount" },
    evidenceProvider: "fixture",
  });
  const index = producerIndex.buildTableProducerIndex(dataRoot, { now: () => "2026-08-27T00:00:00Z" });
  const table = reconcileMultiHop("task-1", {
    dataRoot,
    producerIndex: index,
    maxDepth: 10,
    maxTasks: 10,
    maxEdges: 10,
    now: () => "2026-08-27T00:00:00Z",
  });
  writeFileSync(producerPath, JSON.stringify(index));
  writeFileSync(tablePath, JSON.stringify(table));
  return { dataRoot, factsRoot, producerIndex: producerPath, tableMultiHop: tablePath, producerPath, tablePath, taskDirectory: task.directory };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("read-only target-field causal slice orchestration", () => {
  it("reports INPUT_PACK before analysis and never invokes generation or legacy reconciliation", () => {
    const paths = fixture();
    rmSync(paths.taskDirectory, { recursive: true, force: true });
    const runFacts = vi.spyOn(inputPackMachineFacts, "runInputPackMachineFacts");
    const buildIndex = vi.spyOn(producerIndex, "buildTableProducerIndex");
    const updateIndex = vi.spyOn(producerIndex, "updateTableProducerIndex");
    const oldReconcile = vi.spyOn(oldFieldLineage, "reconcileFieldLineage");
    expect(() => reconcileTargetFieldCausalSlice({
      ...paths,
      taskId: "task-1",
      targetTable: "db.target",
      writeObservationIds: ["write:task-1:0"],
    })).toThrow("STALE_LAYER:INPUT_PACK");
    expect(runFacts).not.toHaveBeenCalled();
    expect(buildIndex).not.toHaveBeenCalled();
    expect(updateIndex).not.toHaveBeenCalled();
    expect(oldReconcile).not.toHaveBeenCalled();
  });

  it.each([
    ["PRODUCER_INDEX", (paths: ReturnType<typeof fixture>) => writeFileSync(paths.producerPath, "{}")],
    ["TABLE_MULTI_HOP", (paths: ReturnType<typeof fixture>) => writeFileSync(paths.tablePath, JSON.stringify({ artifactType: "TABLE_MULTI_HOP_RECONCILIATION", rootTaskId: "task-1", producerIndex: { inputFingerprint: "different", contentHash: "producer" } }))],
  ] as const)("reports the exact stale layer: %s", (layer, mutate) => {
    const paths = fixture();
    mutate(paths);
    const expected = layer as "PRODUCER_INDEX" | "TABLE_MULTI_HOP";
    expect(() => reconcileTargetFieldCausalSlice({ ...paths, taskId: "task-1", targetTable: "db.target", writeObservationIds: ["write:task-1:0"] }))
      .toThrow(`STALE_LAYER:${expected}`);
  });

  it("reports MACHINE_FACTS when immutable facts are absent after matching input fingerprints", () => {
    const paths = fixture();
    expect(() => reconcileTargetFieldCausalSlice({ ...paths, taskId: "task-1", targetTable: "db.target", writeObservationIds: ["write:task-1:0"] }))
      .toThrow("STALE_LAYER:MACHINE_FACTS");
  });
});

describe("target-field causal slice CLI boundaries", () => {
  const required = [
    "--data-root", "input",
    "--facts-root", "facts",
    "--producer-index", "producer.json",
    "--table-multi-hop", "multi-hop.json",
    "--task-id", "task-1",
    "--target-table", "db.target",
    "--output", "slice.json",
  ];

  it("requires an exact root write observation", () => {
    expect(() => parseTargetFieldCausalSliceCli(required)).toThrow(
      "--write-observation-id is required",
    );
  });

  it("rejects colliding canonical and summary outputs", () => {
    expect(() => parseTargetFieldCausalSliceCli([
      ...required,
      "--write-observation-id", "write:task-1:0",
      "--summary-output", "slice.json",
    ])).toThrow("causal-slice output paths must not collide");
  });

  it("rejects the removed Calcite semantic-oracle flags", () => {
    expect(() => parseTargetFieldCausalSliceCli([
      ...required,
      "--write-observation-id", "write:task-1:0",
      "--semantic-oracle", "calcite",
      "--calcite-mapping-report", "mapping.json",
      "--semantic-oracle-output", "mapping.json",
    ])).toThrow("moved to the Calcite Sidecar");
  });

  it("rejects attaching independent Calcite causal evidence to the canonical slice", () => {
    expect(() => parseTargetFieldCausalSliceCli([
      ...required,
      "--write-observation-id", "write:task-1:0",
      "--calcite-causal-evidence", "sidecar-report.json",
    ])).toThrow("independent-only");
  });

  it("rejects overwriting producer evidence or writing inside facts", () => {
    expect(() => parseTargetFieldCausalSliceCli([
      ...required.slice(0, -2),
      "--output", "producer.json",
      "--write-observation-id", "write:task-1:0",
    ])).toThrow("must not overwrite an input evidence file");
    expect(() => parseTargetFieldCausalSliceCli([
      ...required.slice(0, -2),
      "--output", "facts/registry/overwrite.json",
      "--write-observation-id", "write:task-1:0",
    ])).toThrow("must not be written inside immutable input evidence roots");
  });
});

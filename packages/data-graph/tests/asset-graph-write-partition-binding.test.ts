import { describe, expect, it } from "vitest";

import { taskWriters, type Evidence } from "../src/asset-graph/publish.ts";
import type { TaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";

type Write = { id: string; target: string };

function projection(writes: readonly Write[]): TaskLocalProjection {
  return {
    taskId: "producer",
    localClosure: {
      finalWrites: writes.map(({ id, target }) => ({
        writeObservationId: id,
        targetWriteNodeId: `write:${id}`,
        datasetNodeId: `dataset:${target}`,
        qualifiedName: target,
      })),
      externalReads: [],
      localFieldPaths: [],
    },
  } as unknown as TaskLocalProjection;
}

function evidence(
  datasetIo: Evidence["datasetIo"],
  statements: Evidence["statements"],
): Evidence {
  return {
    bindings: [],
    statements,
    datasetIo,
    expressions: [],
    relations: [],
    packPartition: { p: "PACK" },
    packTarget: { qualifiedName: "dm.target" },
    sqlSources: [],
  };
}

describe("asset graph write partition binding", () => {
  it("keeps same-table SQL writes separated by their Facts write observation", () => {
    const writers = taskWriters(
      projection([{ id: "write:one", target: "dm.target" }, { id: "write:two", target: "dm.target" }]),
      evidence(
        [
          { write_observation_id: "write:one", write_statement_id: "stmt:one", physical_dataset: "dm.target" },
          { write_observation_id: "write:two", write_statement_id: "stmt:two", physical_dataset: "dm.target" },
        ],
        [
          { statement_id: "stmt:one", raw_sql: "insert overwrite table dm.target partition(p='ONE') select 1" },
          { statement_id: "stmt:two", raw_sql: "insert overwrite table dm.target partition(p='TWO') select 1" },
        ],
      ),
    );
    expect(writers.map((writer) => writer.partition?.[0]?.values)).toEqual([["ONE"], ["TWO"]]);
  });

  it("does not apply one Pack partition to same-table multiple writes without SQL", () => {
    const writers = taskWriters(
      projection([{ id: "write:one", target: "dm.target" }, { id: "write:two", target: "dm.target" }]),
      evidence(
        [
          { write_observation_id: "write:one", physical_dataset: "dm.target", partition_mode: "STATIC", partition_assignments: [{ field: "p", status: "CONFIRMED" }] },
          { write_observation_id: "write:two", physical_dataset: "dm.target", partition_mode: "STATIC", partition_assignments: [{ field: "p", status: "CONFIRMED" }] },
        ],
        [],
      ),
    );
    expect(writers.map((writer) => writer.partition?.[0]?.values)).toEqual([[], []]);
  });

  it("uses Facts before a Pack and leaves a missing write binding unknown", () => {
    const writers = taskWriters(
      projection([{ id: "write:dynamic", target: "dm.target" }, { id: "write:missing", target: "dm.target" }]),
      evidence(
        [{ write_observation_id: "write:dynamic", write_statement_id: "stmt:dynamic", physical_dataset: "dm.target", partition_mode: "DYNAMIC", partition_assignments: [{ field: "p", status: "CONFIRMED" }] }],
        [{ statement_id: "stmt:dynamic", raw_sql: "select 1" }],
      ),
    );
    expect(writers[0]?.partition).toEqual([expect.objectContaining({ column: "p", values: [], partitionStatus: "DYNAMIC" })]);
    expect(writers[1]?.partition).toEqual([expect.objectContaining({ column: "__unresolved_partition__", values: [] })]);
  });

  it("passes write-bound Facts expressions to dynamic partition recovery", () => {
    const writers = taskWriters(
      projection([{ id: "write:dynamic", target: "dm.target" }]),
      {
        ...evidence(
          [{ write_observation_id: "write:dynamic", write_statement_id: "stmt:dynamic", physical_dataset: "dm.target", partition_mode: "DYNAMIC", partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] }],
          [{ statement_id: "stmt:dynamic", raw_sql: "select 1" }],
        ),
        bindings: [{ write_observation_id: "write:dynamic", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:p" }],
        expressions: [{ expression_id: "expr:p", relation_id: "rel:p", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "'BOUND' as p" }],
        relations: [],
      },
    );
    expect(writers[0]?.partition).toEqual([expect.objectContaining({ column: "p", values: ["BOUND"], partitionStatus: "STATIC" })]);
  });

  it("allows a Pack only for its uniquely written target", () => {
    const writers = taskWriters(
      projection([{ id: "write:target", target: "dm.target" }, { id: "write:other", target: "dm.other" }]),
      evidence(
        [
          { write_observation_id: "write:target", physical_dataset: "dm.target", partition_mode: "STATIC", partition_assignments: [{ field: "p", status: "CONFIRMED" }] },
          { write_observation_id: "write:other", physical_dataset: "dm.other", partition_mode: "STATIC", partition_assignments: [{ field: "p", status: "CONFIRMED" }] },
        ],
        [],
      ),
    );
    expect(writers[0]?.partition?.[0]?.values).toEqual(["PACK"]);
    expect(writers[1]?.partition?.[0]?.values).toEqual([]);
  });

  it("fails closed when Facts NONE conflicts with an exact SQL partition", () => {
    const writers = taskWriters(
      projection([{ id: "write:none", target: "dm.target" }]),
      evidence(
        [{ write_observation_id: "write:none", write_statement_id: "stmt:none", physical_dataset: "dm.target", partition_mode: "NONE" }],
        [{ statement_id: "stmt:none", raw_sql: "insert overwrite table dm.target partition(p='03') select 1" }],
      ),
    );
    expect(writers[0]?.partition).toEqual([expect.objectContaining({ values: [], partitionStatus: "UNKNOWN" })]);
  });
});

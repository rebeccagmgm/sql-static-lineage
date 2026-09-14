import { describe, expect, it } from "vitest";
import {
  memberAllowsNode,
  parseBatch,
  projectScope,
  restoreScopes,
} from "./model";
import type { ScopeMember } from "./model";
import type { GraphNode, TraceResult } from "../types";

const source: GraphNode = {
  id: "dataset:a",
  kind: "PHYSICAL_DATASET",
  table: "ods.party",
  detail: { platform: "hive", dataSource: "one", qualifiedName: "ods.party" },
};
const members: ScopeMember[] = [
  {
    kind: "PHYSICAL_DATASET",
    value: "ods.party",
    enabled: true,
    node: source,
  },
  {
    kind: "TASK",
    value: "7",
    enabled: true,
    node: { id: "task:7", taskId: "7", kind: "TASK" },
  },
];
const trace = (
  nodes: GraphNode[],
  edges: TraceResult["edges"],
): TraceResult => ({
  version: "v1",
  layer: "table",
  direction: "up",
  depthLimit: 1,
  edgeLimit: 400,
  truncated: false,
  stoppedBy: null,
  frontierNodeIds: [],
  terminalNodes: [],
  nodes,
  edges,
  elapsedMs: 1,
});

describe("analysis scope", () => {
  it("parses exact names and IDs, deduplicates, rejects broad patterns", () => {
    expect(parseBatch("7，8\n7").map((x) => x.value)).toEqual(["7", "8"]);
    expect(parseBatch("ODS.PARTY\nods.party")).toHaveLength(1);
    expect(parseBatch("ODS.PARTY\n7").map((x) => x.kind)).toEqual([
      "PHYSICAL_DATASET",
      "TASK",
    ]);
    expect(() => parseBatch("%t01%")).toThrow();
    expect(() => parseBatch("7; DROP TABLE t")).toThrow();
  });
  it("preserves physical identity, never matches a different source with the same name", () => {
    const field: GraphNode = {
      id: "field:a",
      kind: "READ_FIELD",
      taskId: "7",
      table: "ods.party",
      detail: { ...source.detail, column: "id" },
    };
    expect(memberAllowsNode(members, field)).toBe(true);
    expect(
      memberAllowsNode(members, {
        ...field,
        detail: { ...field.detail, dataSource: "two" },
      }),
    ).toBe(false);
    expect(memberAllowsNode(members, { ...field, detail: {} })).toBe(false);
    expect(memberAllowsNode(members, { ...field, taskId: "8" })).toBe(false);
  });
  it("retains only selected endpoints and observed edges; exposes boundary without expanding", () => {
    const other = {
      id: "dataset:other",
      kind: "PHYSICAL_DATASET",
      table: "ods.other",
    };
    const result = projectScope(
      trace(
        [source, members[1]!.node, other],
        [
          { id: "in", from: source.id, to: "task:7", kind: "READS_TABLE" },
          { id: "out", from: "task:7", to: other.id, kind: "WRITES_TABLE" },
        ],
      ),
      members,
    );
    expect(result.trace.nodes.map((n) => n.id)).toEqual([source.id, "task:7"]);
    expect(result.trace.edges.map((e) => e.id)).toEqual(["in"]);
    expect(result.boundary.map((n) => n.id)).toEqual([other.id]);
    expect(
      projectScope(
        result.trace,
        members.map((m) => ({ ...m, enabled: false })),
      ).trace.nodes,
    ).toEqual([]);
  });
  it("keeps same-task intermediate field evidence but excludes out-of-scope task paths", () => {
    expect(
      memberAllowsNode(members, {
        id: "w",
        kind: "WRITE_FIELD",
        table: "temp.mid",
        taskId: "7",
      }),
    ).toBe(true);
    expect(
      memberAllowsNode(members, {
        id: "w",
        kind: "WRITE_FIELD",
        table: "temp.mid",
        taskId: "8",
      }),
    ).toBe(false);
  });
  it("rejects malformed saved scopes instead of broadening an unknown membership", () => {
    expect(() => restoreScopes('{"version":99,"entries":[]}')).toThrow();
    expect(() =>
      restoreScopes('{"version":1,"entries":[{"name":"broken"}]}'),
    ).toThrow();
    expect(restoreScopes(null)).toEqual([]);
  });
  it("migrates saved source/target members into table/task seeds and drops target-only focus", () => {
    const result = restoreScopes(
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: "saved",
            name: "TIT",
            version: "v1",
            focusId: "dataset:a",
            clusters: ["A", ""],
            members: [
              {
                kind: "PHYSICAL_DATASET",
                value: "ods.party",
                id: "dataset:a",
                role: "source",
                enabled: true,
              },
              {
                kind: "TASK",
                value: "7",
                id: "task:7",
                role: "task",
                enabled: true,
              },
            ],
          },
        ],
      }),
    );
    expect(result[0]!.members.map((m) => m.kind)).toEqual([
      "PHYSICAL_DATASET",
      "TASK",
    ]);
    expect(result[0]!.members[0]).not.toHaveProperty("role");
    expect(result[0]).not.toHaveProperty("focusId");
    expect(result[0]!.expansions).toEqual([]);
    expect(result[0]!.clusters).toEqual(["A", ""]);
  });
});

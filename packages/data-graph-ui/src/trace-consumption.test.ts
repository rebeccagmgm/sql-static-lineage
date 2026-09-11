import { describe, expect, it } from "vitest";
import { mergeTraceConsumptions } from "./trace-consumption";
import type {
  ConsumptionGroup,
  ConsumptionScope,
  TraceConsumption,
} from "./types";

const scope = (expression: string): ConsumptionScope => ({
  status: "EXPLICIT",
  label: "p=?",
  items: [{ column: "p", values: [], expression, partitionStatus: "DYNAMIC" }],
});

const group = (
  id: string,
  rawNodeIds: string[],
  groupScope: ConsumptionScope = scope("expr"),
): ConsumptionGroup => ({
  id,
  role: "WRITE",
  presentation: "FIELD_GROUP",
  scopeEquivalence: "PROVEN",
  depth: 1,
  scope: groupScope,
  rawNodeIds,
  rawEdgeIds: [],
  rootNodeIds: [],
  fields: [],
  writeRefs: [],
});

const contract = (input: Partial<TraceConsumption>): TraceConsumption => ({
  schemaVersion: "1.0.0",
  groups: [],
  branches: [],
  rootPaths: [],
  ...input,
});

describe("multi-root consumption merge", () => {
  it("does not collapse dynamic expressions that share a display label", () => {
    const first = group("g", ["w1"], scope("today()"));
    first.writeRefs.push({
      taskId: "t",
      writeId: "w",
      rawNodeIds: ["w1"],
      rawEdgeIds: ["e1"],
      scope: scope("today()"),
    });
    const second = group("g", ["w2"], scope("yesterday()"));
    second.writeRefs.push({
      taskId: "t",
      writeId: "w",
      rawNodeIds: ["w2"],
      rawEdgeIds: ["e2"],
      scope: scope("yesterday()"),
    });
    const merged = mergeTraceConsumptions({
      consumptions: [contract({ groups: [first] }), contract({ groups: [second] })],
      allowedNodeIds: new Set(["w1", "w2"]),
      allowedEdgeIds: new Set(["e1", "e2"]),
      allRootNodeIds: ["w1", "w2"],
    })!;
    expect(merged.groups[0]?.writeRefs).toHaveLength(2);
    expect(
      merged.groups[0]?.writeRefs.map(
        (ref) => ref.scope.items[0]?.expression,
      ),
    ).toEqual(["today()", "yesterday()"]);
  });

  it("removes clipped field mappings and recomputes each root path", () => {
    const groups = [group("source", ["w1", "w2"]), group("target", ["r1", "r2"])];
    const shared = {
      id: "branch",
      fromGroupId: "source",
      toGroupId: "target",
      kind: "CONTINUES",
      status: "CONFIRMED",
      scope: scope("expr"),
      rawEdgeIds: ["e1", "e2"],
      rootNodeIds: ["r1", "r2"],
      fieldMappings: [
        { sourceNodeIds: ["w1"], targetNodeIds: ["r1"], rawEdgeIds: ["e1"] },
        { sourceNodeIds: ["w2"], targetNodeIds: ["r2"], rawEdgeIds: ["e2"] },
      ],
    };
    const merged = mergeTraceConsumptions({
      consumptions: [
        contract({
          groups,
          branches: [shared],
          rootPaths: [
            { rootNodeId: "r1", rawNodeIds: ["r1", "w1"], rawEdgeIds: ["e1"], groupIds: ["source", "target"], branchIds: ["branch"] },
            { rootNodeId: "r2", rawNodeIds: ["r2", "w2"], rawEdgeIds: ["e2"], groupIds: ["source", "target"], branchIds: ["branch"] },
          ],
        }),
      ],
      allowedNodeIds: new Set(["w1", "r1", "r2"]),
      allowedEdgeIds: new Set(["e1"]),
      allRootNodeIds: ["r1", "r2"],
    })!;
    expect(merged.branches[0]?.fieldMappings).toEqual([
      expect.objectContaining({ rawEdgeIds: ["e1"], sourceNodeIds: ["w1"] }),
    ]);
    expect(
      merged.rootPaths.find((path) => path.rootNodeId === "r2"),
    ).toMatchObject({ rawEdgeIds: [], branchIds: [] });
  });
});

import { describe, expect, it } from "vitest";

import type { PhysicalFieldExpansion, PhysicalFieldIdentity } from "../../scripts/reconcile/consumer/target-field-causal-slice/canonical-evidence-adapter.ts";
import {
  traverseCausalDependencies,
  type CausalTraversalInput,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";
import {
  createProofRef,
  makeSemanticDependencyEdge,
  type LocalEdgeKind,
  type ProofRef,
  type RootDependenceKind,
  type SemanticDependencyEdge,
  type PhysicalFieldSubject,
  type SemanticSubject,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import type { SemanticDependencyNormalization } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-normalizer.ts";

const target = (name: string): PhysicalFieldIdentity => ({
  platform: "hive",
  dataSource: "horae",
  stableTableId: "table-1",
  qualifiedName: "db.target",
  column: name,
  identityStatus: "SCHEMA_BACKED",
});

const upstream = (name: string, table = "db.source"): PhysicalFieldIdentity => ({
  platform: "hive",
  dataSource: "horae",
  stableTableId: table === "db.source" ? "table-2" : "table-3",
  qualifiedName: table,
  column: name,
  identityStatus: "SCHEMA_BACKED",
});

function fieldSubject(field: PhysicalFieldIdentity): PhysicalFieldSubject {
  return {
    subjectKind: "PHYSICAL_FIELD",
    physicalFieldId: [
      field.platform,
      field.dataSource,
      field.stableTableId,
      field.qualifiedName,
      field.column,
    ].map((part) => part.toLowerCase()).join("|"),
  };
}

function relationSubject(id: string): SemanticSubject {
  return { subjectKind: "RELATION_OCCURRENCE", relationOccurrenceId: id };
}

function physicalId(subject: SemanticSubject): string {
  if (subject.subjectKind !== "PHYSICAL_FIELD") throw new Error("expected physical field");
  return subject.physicalFieldId;
}

function normalization(
  root: SemanticSubject,
  from: SemanticSubject,
  localEdgeKind: LocalEdgeKind,
  rootDependenceKind: RootDependenceKind =
    localEdgeKind === "VALUE_FLOW" ? "VALUE_TO_TARGET" : "CONTROL_TO_TARGET",
  certainty: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN" = "CONFIRMED",
  dependencyId = `${localEdgeKind}:${JSON.stringify(from)}`,
  proofRefs: readonly ProofRef[] = [],
): SemanticDependencyNormalization {
  const edge = makeSemanticDependencyEdge({
    dependencyId,
    fromSubject: from,
    toSubject: root,
    rootDependenceKind,
    localEdgeKind,
    pathCertainty: certainty,
    proofRefs,
  });
  return {
    definitions: [],
    applications: [],
    edges: [edge],
    semanticEdges: [edge],
    gaps: [],
    legacyEdges: [],
  };
}

function input(
  roots: CausalTraversalInput["roots"],
  slices: readonly [string, readonly SemanticDependencyNormalization[]][],
  expandPhysicalField: CausalTraversalInput["expandPhysicalField"],
  options?: CausalTraversalInput["options"],
): CausalTraversalInput {
  const identities = new Map<string, PhysicalFieldIdentity>();
  for (const field of [
    target("amount"),
    target("price"),
    upstream("status"),
    upstream("amount"),
  ]) {
    identities.set(physicalId(fieldSubject(field)), field);
  }
  return {
    roots,
    semanticDependencies: new Map(slices),
    resolvePhysicalField: (physicalFieldId) => identities.get(physicalFieldId) ?? null,
    expandPhysicalField,
    options,
  };
}

function noExpansion(): PhysicalFieldExpansion {
  return { classified: true, ambiguous: false, producers: [], candidates: [], gaps: [] };
}

function producerExpansion(
  producerTaskId: string,
  producerField: PhysicalFieldIdentity,
  readOccurrenceIds = ["read-1"],
  evidenceStatus: "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED" = "CONFIRMED",
): PhysicalFieldExpansion {
  return {
    classified: true,
    ambiguous: false,
    candidates: [],
    gaps: [],
    producers: [{
      producerTaskId,
      producerPack: null,
      producerField,
      producerBindings: [],
      bridge: { readOccurrence: { occurrenceId: readOccurrenceIds[0] } },
      bridges: readOccurrenceIds.map((occurrenceId) => ({ readOccurrence: { occurrenceId } })),
      producerRole: "PRIMARY",
      evidenceStatus,
      evidenceRefs: [`bridge:${producerTaskId}`],
      shouldRecurse: true,
    }],
  };
}

describe("causal traversal", () => {
  it("keeps each root target field's visited and decision state independent", () => {
    const amount = fieldSubject(target("amount"));
    const price = fieldSubject(target("price"));
    const sourceAmount = fieldSubject(upstream("amount"));
    const sourceStatus = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(input(
      [
        { rootTargetFieldId: physicalId(amount), taskId: "task-root", subject: amount },
        { rootTargetFieldId: physicalId(price), taskId: "task-root", subject: price },
      ],
      [
        ["task-root", [
          normalization(amount, sourceAmount, "VALUE_FLOW"),
          normalization(price, sourceStatus, "ROWSET_CONTROL", "CONTROL_TO_TARGET", "UNKNOWN"),
        ]],
        ["task-source", []],
      ],
      () => noExpansion(),
    ));
    const amountResult = result.roots.find((root) => root.root.rootTargetFieldId === physicalId(amount))!;
    const priceResult = result.roots.find((root) => root.root.rootTargetFieldId === physicalId(price))!;
    expect(amountResult.decision.valuePathCertainty).toBe("CONFIRMED");
    expect(amountResult.decision.controlPathCertainty).toBeNull();
    expect(priceResult.decision.controlPathCertainty).toBe("UNKNOWN");
    expect(priceResult.decision.controlGapIds.length).toBeGreaterThan(0);
    expect(amountResult.visitedStateKeys).not.toEqual(priceResult.visitedStateKeys);
  });

  it("preserves control root reason while recording VALUE_FLOW across a producer bridge", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const producer = upstream("status", "db.control");
    const producerSubject = fieldSubject(producer);
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [
        ["task-root", [normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET")]],
        ["task-control", [normalization(control, producerSubject, "VALUE_FLOW", "CONTROL_TO_TARGET")]],
      ],
      (request) => request.taskId === "task-root"
        ? producerExpansion("task-control", producer)
        : noExpansion(),
    ));
    const edges = result.roots[0]!.paths.flatMap((path) => path.edges);
    expect(edges.some((edge) => edge.localEdgeKind === "ROWSET_CONTROL")).toBe(true);
    expect(edges.some((edge) => edge.localEdgeKind === "VALUE_FLOW" && edge.rootDependenceKind === "CONTROL_TO_TARGET")).toBe(true);
  });

  it("isolates repeated read occurrences into separate states and deterministic paths", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
      () => producerExpansion("task-producer", upstream("amount"), ["read-a", "read-b"]),
    ));
    const rootResult = result.roots[0]!;
    expect(rootResult.visitedStateKeys.filter((key) => key.includes('"readOccurrenceId":"read-a"')).length).toBe(1);
    expect(rootResult.visitedStateKeys.filter((key) => key.includes('"readOccurrenceId":"read-b"')).length).toBe(1);
    expect(rootResult.paths.map((path) => path.pathId)).toEqual(
      [...rootResult.paths.map((path) => path.pathId)].sort(),
    );
    expect(
      rootResult.paths
        .flatMap((path) => path.edges)
        .filter((edge) => edge.fromTaskId !== edge.toTaskId)
        .map((edge) => edge.readOccurrenceId)
        .filter((value): value is string => value !== undefined)
        .sort(),
    ).toEqual(["read-a", "read-b"]);
  });

  it("keeps fieldless relation dependencies and blocks closure without a relation expander", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const sourceRef = createProofRef(
      "SOURCE_SPAN",
      "plan:relation:read-b:10:20",
    );
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(
          root,
          relation,
          "RELATION_CONTEXT",
          "RELATION_TO_TARGET",
          "CONFIRMED",
          "relation:read-b",
          [sourceRef],
        ),
      ]]],
      undefined,
    ));
    const path = result.roots[0]!.paths[0]!;
    expect(path.edges[0]!.fromSubject).toEqual(relation);
    expect(result.roots[0]!.gaps.some((gap) => gap.reasonCode === "PHYSICAL_EXPANSION_UNAVAILABLE")).toBe(false);
    const gap = result.roots[0]!.gaps.find(
      (candidate) => candidate.reasonCode === "RELATION_EXPANSION_UNAVAILABLE",
    );
    expect(gap?.subject).toEqual(relation);
    expect(gap?.rootDependenceKind).toBe("RELATION_TO_TARGET");
    expect(gap?.evidenceRefs).toContain(sourceRef.refId);
    expect(gap?.blocksNegativeProof).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("bridges a fieldless relation dependency to an exact producer occurrence", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const result = traverseCausalDependencies({
      ...input(
        [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
        [["task-root", [normalization(root, relation, "RELATION_CONTEXT", "RELATION_TO_TARGET")]]],
        undefined,
        { maxValueStates: 0, maxControlStates: 10, maxControlPaths: 10 },
      ),
      expandRelationOccurrence: () => ({
        relationBridges: [{
          producerTaskId: "task-producer",
          readOccurrenceId: "read-b",
          evidenceStatus: "CONFIRMED",
          evidenceRefs: ["table-bridge:read-b"],
        }],
      }),
    });
    const paths = result.roots[0]!.paths;
    const path = paths.find((candidate) =>
      candidate.edges.some((edge) =>
        edge.localEdgeKind === "RELATION_CONTEXT" &&
        edge.fromTaskId === "task-producer" &&
        edge.readOccurrenceId === "read-b",
      ),
    );
    expect(path).toBeDefined();
    expect(path!.edges.at(-1)).toMatchObject({
      fromTaskId: "task-producer",
      toTaskId: "task-root",
      fromSubject: relation,
      toSubject: relation,
      localEdgeKind: "RELATION_CONTEXT",
      readOccurrenceId: "read-b",
    });
    expect(path!.edges.at(-1)!.evidenceRefs).toContain("table-bridge:read-b");
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
  });

  it("keeps upstream VALUE_FLOW on the control path budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET"),
        normalization(control, value, "VALUE_FLOW"),
      ]]],
      () => noExpansion(),
      { maxValuePaths: 0, maxControlPaths: 1 },
    ));

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.edges.some((edge) =>
      edge.localEdgeKind === "VALUE_FLOW" &&
      edge.rootDependenceKind === "CONTROL_TO_TARGET"
    )).toBe(false);
    expect(result.gaps.some((candidate) =>
      candidate.reasonCode === "MAX_VALUE_PATHS_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("keeps an upstream VALUE frontier on the control state budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET"),
        normalization(control, value, "VALUE_FLOW"),
      ]]],
      () => noExpansion(),
      {
        maxValueStates: 10,
        maxControlStates: 1,
        maxValuePaths: 10,
        maxControlPaths: 10,
      },
    ));

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_STATES_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.gaps.some((candidate) =>
      candidate.reasonCode === "MAX_VALUE_STATES_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("charges a producer VALUE_FLOW bridge on a control path to control", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET"),
      ]]],
      () => producerExpansion("task-control", upstream("status")),
      { maxValuePaths: 0, maxControlPaths: 1 },
    ));

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.gaps.some((candidate) =>
      candidate.reasonCode === "MAX_VALUE_PATHS_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("charges an ordinary value path to the value budget", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [normalization(root, value, "VALUE_FLOW")]]],
      () => noExpansion(),
      { maxValuePaths: 0, maxControlPaths: 10 },
    ));

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_VALUE_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("VALUE_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.gaps.some((candidate) =>
      candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(false);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("does not charge a control-first criterion to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET"),
      ]]],
      () => noExpansion(),
      { maxValueStates: 0, maxControlStates: 1 },
    ));

    expect(result.gaps.some((gap) =>
      gap.reasonCode === "MAX_VALUE_STATES_REACHED"
    )).toBe(false);
    expect(result.gaps.some((gap) =>
      gap.reasonCode === "MAX_CONTROL_STATES_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(0);
    expect(result.roots[0]!.frontiers.ROWSET_CONTROL).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("does not charge a relation-first criterion to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const base = input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, relation, "RELATION_CONTEXT", "RELATION_TO_TARGET"),
      ]]],
      undefined,
      { maxValueStates: 0, maxControlStates: 1 },
    );
    const result = traverseCausalDependencies({
      ...base,
      expandRelationOccurrence: () => ({
        relationOccurrences: [{
          taskId: "task-root",
          relationOccurrenceId: "relation:0:read-child",
          evidenceStatus: "CONFIRMED",
        }],
      }),
    });

    expect(result.gaps.some((gap) =>
      gap.reasonCode === "MAX_VALUE_STATES_REACHED"
    )).toBe(false);
    expect(result.gaps.some((gap) =>
      gap.reasonCode === "MAX_CONTROL_STATES_REACHED"
    )).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(0);
    expect(result.roots[0]!.frontiers.RELATION_CONTEXT).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("charges the first actual value branch state to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [normalization(root, value, "VALUE_FLOW")]]],
      () => noExpansion(),
      { maxValueStates: 0, maxControlStates: 10, maxValuePaths: 10 },
    ));

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_VALUE_STATES_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("VALUE_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.roots[0]!.frontiers.VALUE).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(false);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("uses independent budgets and emits source-bearing limit gaps", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [
        normalization(root, value, "VALUE_FLOW"),
        normalization(root, control, "ROWSET_CONTROL", "CONTROL_TO_TARGET"),
      ]]],
      () => noExpansion(),
      { maxValueStates: 10, maxValuePaths: 10, maxControlStates: 0, maxControlPaths: 10 },
    ));
    const decision = result.roots[0]!.decision;
    expect(decision.valuePathCertainty).toBe("CONFIRMED");
    expect(decision.valueClosed).toBe(true);
    expect(decision.controlClosed).toBe(false);
    expect(result.gaps.some((gap) => gap.reasonCode === "MAX_CONTROL_STATES_REACHED" && gap.frontierKind === "ROWSET_CONTROL")).toBe(true);
  });

  it("terminates producer cycles and lowers provisional evidence to conditional", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(input(
      [{ rootTargetFieldId: physicalId(root), taskId: "task-root", subject: root }],
      [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
      (request) => producerExpansion(request.taskId, upstream("amount"), ["cycle"], "PROVISIONAL_LEGACY"),
    ));
    expect(result.roots[0]!.paths.some((path) => path.pathCertainty === "CONDITIONAL")).toBe(true);
    expect(result.roots[0]!.gaps.some((gap) => gap.reasonCode === "CYCLE")).toBe(true);
  });
});

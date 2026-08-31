import { canonicalJson, sha256 } from "../../contracts/runtime.ts";
import type { MultiHopReconciliationResult } from "../../contracts/canonical-artifacts.ts";

export type ProjectEvidenceParitySection =
  | "rootTaskId"
  | "producerIndex"
  | "terminalTableConfig"
  | "taskNodes"
  | "tableNodes"
  | "readEdges"
  | "writeEdges"
  | "producerBridges"
  | "scheduleEdges"
  | "terminals"
  | "scheduleSkeleton"
  | "coverage"
  | "limits"
  | "issues"
  | "boundaries";

export interface ProjectEvidenceParityDifference {
  readonly section: ProjectEvidenceParitySection;
  readonly kind:
    | "SEMANTIC_MISMATCH"
    | "BOUNDARY_MISMATCH"
    | "SOURCE_ROOT_LEAK"
    | "STRONGER_CONFIRMATION";
  readonly expectedHash: string;
  readonly actualHash: string;
}

export interface ProjectEvidenceParityResult {
  readonly rootTaskId: string;
  readonly matches: boolean;
  readonly differences: readonly ProjectEvidenceParityDifference[];
}

const SECTIONS: readonly ProjectEvidenceParitySection[] = [
  "rootTaskId",
  "producerIndex",
  "terminalTableConfig",
  "taskNodes",
  "tableNodes",
  "readEdges",
  "writeEdges",
  "producerBridges",
  "scheduleEdges",
  "terminals",
  "scheduleSkeleton",
  "coverage",
  "limits",
  "issues",
  "boundaries",
];

const VOLATILE_FIELDS = new Set([
  "generatedAt",
  "observedAt",
  "cacheStatus",
  "cachePath",
  "inputPackPath",
  "contentHash",
]);

export function compareProjectRootTraversal(
  expected: MultiHopReconciliationResult,
  actual: MultiHopReconciliationResult,
): ProjectEvidenceParityResult {
  const differences: ProjectEvidenceParityDifference[] = [];
  for (const section of SECTIONS) {
    const expectedCanonical = canonicalJson(normalized(expected[section]));
    const actualCanonical = canonicalJson(normalized(actual[section]));
    if (expectedCanonical === actualCanonical) continue;
    differences.push({
      section,
      kind: differenceKind(section, expected, actual),
      expectedHash: sha256(expectedCanonical),
      actualHash: sha256(actualCanonical),
    });
  }
  return {
    rootTaskId: expected.rootTaskId,
    matches: differences.length === 0,
    differences,
  };
}

export function normalizedProjectRootTraversal(
  result: MultiHopReconciliationResult,
): Readonly<Record<ProjectEvidenceParitySection, unknown>> {
  return Object.fromEntries(
    SECTIONS.map((section) => [section, normalized(result[section])]),
  ) as Readonly<Record<ProjectEvidenceParitySection, unknown>>;
}

function differenceKind(
  section: ProjectEvidenceParitySection,
  expected: MultiHopReconciliationResult,
  actual: MultiHopReconciliationResult,
): ProjectEvidenceParityDifference["kind"] {
  if (section === "terminals" || section === "limits")
    return "BOUNDARY_MISMATCH";
  if (section === "taskNodes" && hasUnexpectedTask(expected, actual))
    return "SOURCE_ROOT_LEAK";
  if (
    section === "producerBridges" &&
    hasStrongerProducerRole(expected, actual)
  )
    return "STRONGER_CONFIRMATION";
  return "SEMANTIC_MISMATCH";
}

function hasUnexpectedTask(
  expected: MultiHopReconciliationResult,
  actual: MultiHopReconciliationResult,
): boolean {
  const expectedIds = new Set(expected.taskNodes.map((task) => task.taskId));
  return actual.taskNodes.some((task) => !expectedIds.has(task.taskId));
}

function hasStrongerProducerRole(
  expected: MultiHopReconciliationResult,
  actual: MultiHopReconciliationResult,
): boolean {
  const rank: Readonly<Record<string, number>> = {
    CANDIDATE: 0,
    UNKNOWN: 1,
    ADDITIONAL: 2,
    PRIMARY: 3,
  };
  const expectedRoles = new Map(
    expected.producerBridges.map((bridge) => [
      bridgeKey(bridge),
      bridge.producerRole,
    ]),
  );
  return actual.producerBridges.some((bridge) => {
    const expectedRole = expectedRoles.get(bridgeKey(bridge));
    return (
      expectedRole !== undefined &&
      (rank[bridge.producerRole] ?? -1) > (rank[expectedRole] ?? -1)
    );
  });
}

function bridgeKey(
  bridge: MultiHopReconciliationResult["producerBridges"][number],
): string {
  return canonicalJson({
    consumerTaskId: bridge.consumerTaskId,
    table: bridge.table,
    producerTaskId: bridge.producerTaskId,
    occurrenceId: bridge.readOccurrence?.occurrenceId ?? null,
  });
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (typeof value !== "object" || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (VOLATILE_FIELDS.has(key)) continue;
    output[key] = normalized(child);
  }
  return output;
}

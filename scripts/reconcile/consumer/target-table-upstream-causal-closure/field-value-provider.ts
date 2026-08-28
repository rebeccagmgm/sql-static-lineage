import { readFileSync } from "node:fs";

import type { CandidateBranch } from "../target-field-causal-slice/candidate-universe.ts";

export interface FieldValueImpact {
  readonly candidateBranchId: string;
  readonly status: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN" | "PROVEN_ABSENT";
  readonly affectedTargetFields: readonly string[];
  readonly outputFieldBindingIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly gapRefs: readonly string[];
}
export interface FieldValueEvidenceProvider {
  readonly lookup: (branch: CandidateBranch) => FieldValueImpact;
  readonly scanCount: number;
  readonly edgeCount: number;
}

type JsonRecord = Readonly<Record<string, any>>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function fieldOf(node: JsonRecord): JsonRecord {
  return record(node.field);
}

function nodeKey(node: JsonRecord): string {
  const field = fieldOf(node);
  return [text(node.taskId), text(field.stableTableId), text(field.qualifiedName), text(field.column)].map((value) => (value ?? "").toLowerCase()).join("|");
}

function branchTableKey(branch: CandidateBranch): string {
  const table = branch.table;
  return [table?.stableTableId, table?.qualifiedName].map((value) => (value ?? "").toLowerCase()).join("|");
}

/**
 * Loads the legacy field artifact exactly once and indexes only VALUE_FLOW
 * edges. It is an evidence adapter, not a second traversal engine.
 */
export function createFieldValueEvidenceProvider(path: string | null | undefined): FieldValueEvidenceProvider {
  let scanCount = 0;
  const byBranch = new Map<string, FieldValueImpact>();
  if (!path) {
    return unknownProvider(() => ++scanCount);
  }
  try {
    scanCount += 1;
    const artifact = JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
    const nodes = Array.isArray(artifact.nodes) ? artifact.nodes.map(record) : [];
    const nodeById = new Map(nodes.map((node) => [text(node.nodeId) ?? "", node]));
    const edges = Array.isArray(artifact.edges) ? artifact.edges.map(record) : [];
    const artifactComplete = text(artifact.overallStatus) === "COMPLETE" && Array.isArray(artifact.gaps) && artifact.gaps.length === 0;
    for (const edge of edges) {
      if (text(edge.kind) !== "VALUE_FLOW") continue;
      const from = nodeById.get(text(edge.fromNodeId) ?? "");
      const to = nodeById.get(text(edge.toNodeId) ?? "");
      if (!from || !to) continue;
      const consumerTaskId = text(edge.consumerTaskId) ?? text(to.taskId);
      const producerTaskId = text(edge.producerTaskId) ?? text(from.taskId);
      const producerTableKey = nodeKey(from);
      const targetKey = `${consumerTaskId}|${producerTaskId}|${producerTableKey}`.toLowerCase();
      const affected = text(fieldOf(to).column);
      const evidence = [
        text(edge.edgeId),
        text(edge.fromNodeId),
        text(edge.toNodeId),
        text(edge.mapping),
      ].filter((value): value is string => value !== null);
      const current = byBranch.get(targetKey);
      byBranch.set(targetKey, {
        candidateBranchId: "",
        status: text(edge.evidenceStatus) === "CONFIRMED" ? "CONFIRMED" : "CONDITIONAL",
        affectedTargetFields: [...new Set([...(current?.affectedTargetFields ?? []), ...(affected ? [affected] : [])])].sort(),
        outputFieldBindingIds: [...new Set([...(current?.outputFieldBindingIds ?? []), ...(text(to.bindingId) ? [text(to.bindingId)!] : [])])].sort(),
        evidenceRefs: [...new Set([...(current?.evidenceRefs ?? []), ...evidence.map((value) => `field-lineage:${value}`)])].sort(),
        gapRefs: [...(current?.gapRefs ?? [])],
      });
    }
    return {
      scanCount,
      edgeCount: edges.length,
      lookup: (branch) => {
        if (branch.branchKind !== "PHYSICAL_PRODUCER" || !branch.table || !branch.consumerTaskId || !branch.producerTaskId) return {
          candidateBranchId: branch.candidateBranchId, status: "PROVEN_ABSENT", affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [],
        };
        const keyPrefix = `${branch.consumerTaskId}|${branch.producerTaskId}|`;
        const candidates = [...byBranch.entries()].filter(([key]) => key.startsWith(keyPrefix.toLowerCase()) && key.includes(branchTableKey(branch)));
        const value = candidates.map(([, item]) => item).sort((a, b) => b.evidenceRefs.length - a.evidenceRefs.length)[0];
        if (value) return { ...value, candidateBranchId: branch.candidateBranchId };
        return artifactComplete
          ? { candidateBranchId: branch.candidateBranchId, status: "PROVEN_ABSENT", affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [] }
          : { candidateBranchId: branch.candidateBranchId, status: "UNKNOWN", affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [`field-value-gap:${branch.candidateBranchId}:ARTIFACT_PARTIAL`] };
      },
    };
  } catch (error) {
    return unknownProvider(() => ++scanCount, error instanceof Error ? error.message : String(error));
  }
}

function unknownProvider(scan: () => number, detail = "field-lineage artifact unavailable"): FieldValueEvidenceProvider {
  scan();
  return {
    scanCount: 1,
    edgeCount: 0,
    lookup: (branch) => ({ candidateBranchId: branch.candidateBranchId, status: "UNKNOWN", affectedTargetFields: [], outputFieldBindingIds: [], evidenceRefs: [], gapRefs: [`field-value-gap:${branch.candidateBranchId}:${detail}`] }),
  };
}

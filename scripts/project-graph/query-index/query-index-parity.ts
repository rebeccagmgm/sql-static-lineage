import {
  canonicalJson,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import { compareText } from "../contracts/project-topology-contract.ts";
import {
  explainFieldEvidenceRecordFromProjection,
  getFieldEvidenceFromProjection,
  traceFieldValuePathFromProjection,
} from "../field-evidence/field-evidence-query.ts";
import {
  explainTopologyEdgeFromProjection,
  getProjectTopologyFromProjection,
  traceProjectUpstreamFromProjection,
} from "../query/project-topology-query.ts";
import {
  explainTargetCausalAssessmentFromProjection,
  getTargetCausalOverlayFromProjection,
  getTargetCausalTaskRollupFromProjection,
} from "../target-causal-overlay/target-causal-overlay-query.ts";
import { createQueryIndexParityReport } from "./query-index-audit-publication.ts";
import type {
  QueryIndexBoundedDifference,
  QueryIndexParityCaseResultV1,
  QueryIndexParityReportV1,
} from "./query-index-contract.ts";
import {
  loadIndexedFieldEvidenceForBuild,
  loadIndexedProjectTopologyForBuild,
  loadIndexedTargetCausalOverlayForBuild,
} from "./query-index-query-source.ts";
import type { LoadedQueryIndexSource } from "./query-index-source.ts";
import type { QueryIndexStore } from "./query-index-store.ts";

type QueryName = QueryIndexParityCaseResultV1["query"];

export interface RequiredQueryIndexParityCase {
  readonly caseId: string;
  readonly query: QueryName;
}

export function requiredQueryIndexParityCases(
  source: LoadedQueryIndexSource,
): readonly RequiredQueryIndexParityCase[] {
  const cases: RequiredQueryIndexParityCase[] = [
    { caseId: "topology:get:normal", query: "get_project_topology" },
    { caseId: "topology:get:bounded", query: "get_project_topology" },
    { caseId: "topology:trace:normal", query: "trace_project_upstream" },
    { caseId: "topology:trace:bounded", query: "trace_project_upstream" },
    { caseId: "topology:trace:not-found", query: "trace_project_upstream" },
    { caseId: "topology:explain:normal", query: "explain_topology_edge" },
    { caseId: "topology:explain:not-found", query: "explain_topology_edge" },
  ];
  for (const field of source.fieldEvidence) {
    const prefix = `field:${field.projection.snapshot.snapshotId}`;
    cases.push(
      { caseId: `${prefix}:get:normal`, query: "get_field_evidence" },
      { caseId: `${prefix}:get:bounded`, query: "get_field_evidence" },
      {
        caseId: `${prefix}:trace:normal`,
        query: "trace_field_value_path",
      },
      {
        caseId: `${prefix}:trace:bounded`,
        query: "trace_field_value_path",
      },
      {
        caseId: `${prefix}:trace:not-found`,
        query: "trace_field_value_path",
      },
      {
        caseId: `${prefix}:explain:normal`,
        query: "explain_field_evidence_record",
      },
      {
        caseId: `${prefix}:explain:not-found`,
        query: "explain_field_evidence_record",
      },
    );
  }
  for (const causal of source.targetCausalOverlays) {
    const prefix = `causal:${causal.projection.snapshot.snapshotId}`;
    cases.push(
      { caseId: `${prefix}:get:normal`, query: "get_target_causal_overlay" },
      { caseId: `${prefix}:get:bounded`, query: "get_target_causal_overlay" },
      { caseId: `${prefix}:get:filtered`, query: "get_target_causal_overlay" },
      {
        caseId: `${prefix}:task:normal`,
        query: "get_target_causal_task_rollup",
      },
      {
        caseId: `${prefix}:task:not-found`,
        query: "get_target_causal_task_rollup",
      },
      {
        caseId: `${prefix}:explain:normal`,
        query: "explain_target_causal_assessment",
      },
      {
        caseId: `${prefix}:explain:not-found`,
        query: "explain_target_causal_assessment",
      },
    );
  }
  return cases.sort((left, right) => compareText(left.caseId, right.caseId));
}

export function assertRequiredQueryIndexParityCoverage(
  source: LoadedQueryIndexSource,
  report: QueryIndexParityReportV1,
): void {
  const expected = requiredQueryIndexParityCases(source);
  const actual = report.cases
    .filter(({ required }) => required)
    .map(({ caseId, query }) => ({ caseId, query }))
    .sort((left, right) => compareText(left.caseId, right.caseId));
  if (canonicalJson(actual) !== canonicalJson(expected))
    throw new Error("QUERY_INDEX_REQUIRED_PARITY_CASES_INCOMPLETE");
}

export async function runRequiredQueryIndexParity(input: {
  readonly source: LoadedQueryIndexSource;
  readonly store: QueryIndexStore;
}): Promise<QueryIndexParityReportV1> {
  const explicitBuild = {
    store: input.store,
    indexBuildId: input.source.indexBuildId,
    expectedSourceDescriptorHash: input.source.descriptorHash,
  };
  const indexedTopology =
    await loadIndexedProjectTopologyForBuild(explicitBuild);
  const cases: QueryIndexParityCaseResultV1[] = [];
  const topologyReference = input.source.topology;
  const topologyEdge = chooseTopologyEdge(topologyReference.projection.edges);
  const topologyStart = topologyEdge
    ? topologyEdge.edgeType === "WRITES"
      ? topologyEdge.toNodeId
      : topologyEdge.fromNodeId
    : (topologyReference.projection.nodes[0]?.nodeId ?? "missing-node");
  cases.push(
    compareQueryCase(
      "topology:get:normal",
      "get_project_topology",
      getProjectTopologyFromProjection(topologyReference, { limit: 5_000 }),
      getProjectTopologyFromProjection(indexedTopology, { limit: 5_000 }),
    ),
    compareQueryCase(
      "topology:get:bounded",
      "get_project_topology",
      getProjectTopologyFromProjection(topologyReference, {
        offset: 1,
        limit: 1,
      }),
      getProjectTopologyFromProjection(indexedTopology, {
        offset: 1,
        limit: 1,
      }),
    ),
    compareQueryCase(
      "topology:trace:normal",
      "trace_project_upstream",
      traceProjectUpstreamFromProjection(topologyReference, {
        startNodeId: topologyStart,
      }),
      traceProjectUpstreamFromProjection(indexedTopology, {
        startNodeId: topologyStart,
      }),
    ),
    compareQueryCase(
      "topology:trace:bounded",
      "trace_project_upstream",
      traceProjectUpstreamFromProjection(topologyReference, {
        startNodeId: topologyStart,
        maxHops: 0,
        maxNodes: 1,
        maxEdges: 1,
        maxPaths: 1,
      }),
      traceProjectUpstreamFromProjection(indexedTopology, {
        startNodeId: topologyStart,
        maxHops: 0,
        maxNodes: 1,
        maxEdges: 1,
        maxPaths: 1,
      }),
    ),
    compareQueryCase(
      "topology:trace:not-found",
      "trace_project_upstream",
      traceProjectUpstreamFromProjection(topologyReference, {
        startNodeId: "query-index-missing-node",
      }),
      traceProjectUpstreamFromProjection(indexedTopology, {
        startNodeId: "query-index-missing-node",
      }),
    ),
    compareQueryCase(
      "topology:explain:normal",
      "explain_topology_edge",
      explainTopologyEdgeFromProjection(
        topologyReference,
        topologyEdge?.edgeId ?? "query-index-missing-edge",
      ),
      explainTopologyEdgeFromProjection(
        indexedTopology,
        topologyEdge?.edgeId ?? "query-index-missing-edge",
      ),
    ),
    compareQueryCase(
      "topology:explain:not-found",
      "explain_topology_edge",
      explainTopologyEdgeFromProjection(
        topologyReference,
        "query-index-missing-edge",
      ),
      explainTopologyEdgeFromProjection(
        indexedTopology,
        "query-index-missing-edge",
      ),
    ),
  );

  for (const fieldReference of input.source.fieldEvidence) {
    const snapshotId = fieldReference.projection.snapshot.snapshotId;
    const indexedField = await loadIndexedFieldEvidenceForBuild({
      ...explicitBuild,
      fieldEvidenceSnapshotId: snapshotId,
    });
    const rootField =
      fieldReference.projection.snapshot.selection.rootFields[0] ?? "missing";
    const explainRecord =
      fieldReference.projection.edges.find(
        (edge) => edge.edgeType === "VALUE_FLOW",
      )?.edgeId ??
      fieldReference.projection.nodes[0]?.nodeId ??
      "query-index-missing-record";
    const prefix = `field:${snapshotId}`;
    cases.push(
      compareQueryCase(
        `${prefix}:get:normal`,
        "get_field_evidence",
        getFieldEvidenceFromProjection(fieldReference, { limit: 5_000 }),
        getFieldEvidenceFromProjection(indexedField, { limit: 5_000 }),
      ),
      compareQueryCase(
        `${prefix}:get:bounded`,
        "get_field_evidence",
        getFieldEvidenceFromProjection(fieldReference, {
          offset: 1,
          limit: 1,
        }),
        getFieldEvidenceFromProjection(indexedField, {
          offset: 1,
          limit: 1,
        }),
      ),
      compareQueryCase(
        `${prefix}:trace:normal`,
        "trace_field_value_path",
        traceFieldValuePathFromProjection(fieldReference, { rootField }),
        traceFieldValuePathFromProjection(indexedField, { rootField }),
      ),
      compareQueryCase(
        `${prefix}:trace:bounded`,
        "trace_field_value_path",
        traceFieldValuePathFromProjection(fieldReference, {
          rootField,
          maxHops: 1,
          maxNodes: 1,
          maxEdges: 1,
          maxPaths: 1,
        }),
        traceFieldValuePathFromProjection(indexedField, {
          rootField,
          maxHops: 1,
          maxNodes: 1,
          maxEdges: 1,
          maxPaths: 1,
        }),
      ),
      compareQueryCase(
        `${prefix}:trace:not-found`,
        "trace_field_value_path",
        traceFieldValuePathFromProjection(fieldReference, {
          startStateId: "query-index-missing-state",
        }),
        traceFieldValuePathFromProjection(indexedField, {
          startStateId: "query-index-missing-state",
        }),
      ),
      compareQueryCase(
        `${prefix}:explain:normal`,
        "explain_field_evidence_record",
        explainFieldEvidenceRecordFromProjection(
          fieldReference,
          explainRecord,
          { maxAttachments: 500 },
        ),
        explainFieldEvidenceRecordFromProjection(indexedField, explainRecord, {
          maxAttachments: 500,
        }),
      ),
      compareQueryCase(
        `${prefix}:explain:not-found`,
        "explain_field_evidence_record",
        explainFieldEvidenceRecordFromProjection(
          fieldReference,
          "query-index-missing-record",
        ),
        explainFieldEvidenceRecordFromProjection(
          indexedField,
          "query-index-missing-record",
        ),
      ),
    );
  }
  for (const causalReference of input.source.targetCausalOverlays) {
    const snapshotId = causalReference.projection.snapshot.snapshotId;
    const indexedCausal = await loadIndexedTargetCausalOverlayForBuild({
      ...explicitBuild,
      targetCausalOverlaySnapshotId: snapshotId,
    });
    const assessment = causalReference.projection.nodes.find(
      ({ nodeType }) => nodeType === "CAUSAL_ASSESSMENT",
    );
    const assessmentId =
      typeof assessment?.properties.assessmentId === "string"
        ? assessment.properties.assessmentId
        : "query-index-missing-assessment";
    const taskId = causalReference.projection.snapshot.targetWrite.taskId;
    const prefix = `causal:${snapshotId}`;
    cases.push(
      compareQueryCase(
        `${prefix}:get:normal`,
        "get_target_causal_overlay",
        getTargetCausalOverlayFromProjection(causalReference, { limit: 5_000 }),
        getTargetCausalOverlayFromProjection(indexedCausal, { limit: 5_000 }),
      ),
      compareQueryCase(
        `${prefix}:get:bounded`,
        "get_target_causal_overlay",
        getTargetCausalOverlayFromProjection(causalReference, {
          offset: 1,
          limit: 1,
        }),
        getTargetCausalOverlayFromProjection(indexedCausal, {
          offset: 1,
          limit: 1,
        }),
      ),
      compareQueryCase(
        `${prefix}:get:filtered`,
        "get_target_causal_overlay",
        getTargetCausalOverlayFromProjection(causalReference, {
          relationStatuses: ["CONFIRMED_RELATED"],
          limit: 5_000,
        }),
        getTargetCausalOverlayFromProjection(indexedCausal, {
          relationStatuses: ["CONFIRMED_RELATED"],
          limit: 5_000,
        }),
      ),
      compareQueryCase(
        `${prefix}:task:normal`,
        "get_target_causal_task_rollup",
        getTargetCausalTaskRollupFromProjection(causalReference, taskId),
        getTargetCausalTaskRollupFromProjection(indexedCausal, taskId),
      ),
      compareQueryCase(
        `${prefix}:task:not-found`,
        "get_target_causal_task_rollup",
        getTargetCausalTaskRollupFromProjection(
          causalReference,
          "query-index-missing-task",
        ),
        getTargetCausalTaskRollupFromProjection(
          indexedCausal,
          "query-index-missing-task",
        ),
      ),
      compareQueryCase(
        `${prefix}:explain:normal`,
        "explain_target_causal_assessment",
        explainTargetCausalAssessmentFromProjection(
          causalReference,
          assessmentId,
        ),
        explainTargetCausalAssessmentFromProjection(
          indexedCausal,
          assessmentId,
        ),
      ),
      compareQueryCase(
        `${prefix}:explain:not-found`,
        "explain_target_causal_assessment",
        explainTargetCausalAssessmentFromProjection(
          causalReference,
          "query-index-missing-assessment",
        ),
        explainTargetCausalAssessmentFromProjection(
          indexedCausal,
          "query-index-missing-assessment",
        ),
      ),
    );
  }
  return createQueryIndexParityReport({
    indexBuildId: input.source.indexBuildId,
    sourceDescriptorHash: input.source.descriptorHash,
    cases,
  });
}

export function compareQueryCase(
  caseId: string,
  query: QueryName,
  reference: unknown,
  indexed: unknown,
  required = true,
): QueryIndexParityCaseResultV1 {
  const referenceCanonical = canonicalJson(reference);
  const indexedCanonical = canonicalJson(indexed);
  const difference =
    referenceCanonical === indexedCanonical
      ? null
      : boundedStructuralDifference(reference, indexed);
  return {
    caseId,
    query,
    required,
    status: difference === null ? "PASSED" : "FAILED",
    referenceResultHash: sha256(referenceCanonical),
    indexedResultHash: sha256(indexedCanonical),
    difference,
  };
}

export function boundedStructuralDifference(
  reference: unknown,
  indexed: unknown,
): QueryIndexBoundedDifference {
  return (
    findDifference(reference, indexed, "$", 0) ?? {
      path: "$",
      kind: "VALUE",
      referenceSummary: summary(reference),
      indexedSummary: summary(indexed),
    }
  );
}

function findDifference(
  reference: unknown,
  indexed: unknown,
  path: string,
  depth: number,
): QueryIndexBoundedDifference | null {
  if (canonicalJson(reference) === canonicalJson(indexed)) return null;
  if (depth >= 32) return difference(path, "LIMIT", reference, indexed);
  if (Array.isArray(reference) || Array.isArray(indexed)) {
    if (!Array.isArray(reference) || !Array.isArray(indexed))
      return difference(path, "TYPE", reference, indexed);
    const length = Math.min(reference.length, indexed.length);
    for (let index = 0; index < length; index += 1) {
      const nested = findDifference(
        reference[index],
        indexed[index],
        `${path}[${index}]`,
        depth + 1,
      );
      if (nested !== null) return nested;
    }
    return difference(
      path,
      reference.length > indexed.length ? "MISSING" : "EXTRA",
      reference,
      indexed,
    );
  }
  if (isRecord(reference) || isRecord(indexed)) {
    if (!isRecord(reference) || !isRecord(indexed))
      return difference(path, "TYPE", reference, indexed);
    const keys = [
      ...new Set([...Object.keys(reference), ...Object.keys(indexed)]),
    ].sort(compareText);
    for (const key of keys) {
      if (!(key in reference))
        return difference(
          childPath(path, key),
          "EXTRA",
          undefined,
          indexed[key],
        );
      if (!(key in indexed))
        return difference(
          childPath(path, key),
          "MISSING",
          reference[key],
          undefined,
        );
      const nested = findDifference(
        reference[key],
        indexed[key],
        childPath(path, key),
        depth + 1,
      );
      if (nested !== null) return nested;
    }
  }
  return difference(
    path,
    /(?:limit|truncat|warning|status)/iu.test(path) ? "LIMIT" : "VALUE",
    reference,
    indexed,
  );
}

function difference(
  path: string,
  kind: QueryIndexBoundedDifference["kind"],
  reference: unknown,
  indexed: unknown,
): QueryIndexBoundedDifference {
  return {
    path: path.slice(0, 256),
    kind,
    referenceSummary: summary(reference),
    indexedSummary: summary(indexed),
  };
}

function summary(value: unknown): string {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (isRecord(value)) return `object(keys=${Object.keys(value).length})`;
  if (typeof value === "string")
    return `string(length=${value.length},sha256=${sha256(value).slice(0, 12)})`;
  if (typeof value === "number" || typeof value === "boolean")
    return `${typeof value}(${String(value).slice(0, 32)})`;
  return typeof value;
}

function childPath(path: string, key: string): string {
  const safeKey = /(?:password|secret|token|uri)/iu.test(key)
    ? "<redacted-key>"
    : key.replace(/[^A-Za-z0-9_-]/gu, "_").slice(0, 64);
  return `${path}.${safeKey}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chooseTopologyEdge<
  T extends {
    readonly edgeId: string;
    readonly edgeType: string;
    readonly fromNodeId: string;
    readonly toNodeId: string;
  },
>(edges: readonly T[]): T | null {
  const allowed = new Set([
    "PRODUCER_BRIDGE",
    "SCHEDULE_DEPENDS_ON",
    "READS",
    "ROOT_REACHES_TASK",
    "HAS_ENTRY_TASK",
    "WRITES",
  ]);
  return (
    [...edges]
      .filter((edge) => allowed.has(edge.edgeType))
      .sort((left, right) => compareText(left.edgeId, right.edgeId))[0] ?? null
  );
}

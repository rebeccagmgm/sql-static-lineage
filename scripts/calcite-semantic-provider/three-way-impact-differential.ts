import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  sha256,
} from "../machine-facts/machine-facts-contract.ts";
import type {
  CalciteImpactValueReport,
  ReadImpactValueAssessment,
} from "./impact-value-report.ts";
import {
  CALCITE_PROVIDER_POC_STAGING_ROOT,
  resolvePocOutputPath,
} from "./output-guard.ts";

type JsonRecord = Record<string, unknown>;
type EvidenceStatus =
  "CONFIRMED" | "CONDITIONAL" | "UNKNOWN" | "NOT_OBSERVED" | "NOT_EVALUATED";

export type ThreeWayOverlapClass =
  | "ABC"
  | "AB"
  | "AC"
  | "BC"
  | "A_ONLY"
  | "B_ONLY"
  | "C_ONLY"
  | "NONE"
  | "UNKNOWN";

export interface ThreeWayEvidenceSummary {
  readonly status: EvidenceStatus;
  readonly coarseIdentityObserved: boolean;
  readonly evidenceRefs: readonly string[];
  readonly detailRefs: readonly string[];
  readonly gapRefs: readonly string[];
}

export interface ThreeWayOccurrenceAssessment {
  readonly occurrence: {
    readonly readOccurrenceId: string;
    readonly relationId: string;
    readonly qualifiedPhysicalTable: string;
    readonly sourceSpan: { readonly start: number; readonly end: number };
    readonly identityKind: "EXPLICIT" | "LEGACY_RELATION_SPAN";
  };
  readonly fieldValue: ThreeWayEvidenceSummary & {
    readonly physicalFields: readonly string[];
  };
  readonly nativeIndirect: ThreeWayEvidenceSummary & {
    readonly controlTypes: readonly string[];
  };
  readonly calcite: ThreeWayEvidenceSummary & {
    readonly directFieldValue: boolean;
    readonly indirectChannels: readonly string[];
    readonly witnessDigests: readonly string[];
  };
  readonly overlapClass: ThreeWayOverlapClass;
  readonly calciteIncrementalValue:
    | "PROVEN_OVER_CURRENT_ARTIFACTS"
    | "CANDIDATE_NATIVE_COVERAGE_INCOMPLETE"
    | "OCCURRENCE_PRECISION_ONLY"
    | "NO"
    | "NOT_EVALUATED";
}

export interface ThreeWayCaseReport {
  readonly reportVersion: 1;
  readonly reportKind: "CALCITE_NATIVE_THREE_WAY_CASE";
  readonly taskId: string;
  readonly root: {
    readonly status: "EXACT" | "UNKNOWN";
    readonly writeObservationId?: string;
    readonly sqlSourceId?: string;
    readonly statementOrdinal?: number;
    readonly sqlSha256?: string;
  };
  readonly coverage: {
    readonly fieldLineageArtifactStatus: string;
    readonly fieldValueOccurrenceCoverageComplete: boolean;
    readonly nativeIndirectOccurrenceCoverageComplete: boolean;
    readonly calciteEvaluationStatus: "EVALUATED" | "PARTIAL" | "NOT_EVALUATED";
    readonly calciteReasonCode?: string;
  };
  readonly summary: {
    readonly physicalReadOccurrenceCount: number;
    readonly fieldValuePositiveCount: number;
    readonly nativeIndirectPositiveCount: number;
    readonly calcitePositiveCount: number;
    readonly calciteIndirectPositiveCount: number;
    readonly calciteOnlyCount: number;
    readonly calciteOnlyCandidateCount: number;
    readonly calciteOccurrencePrecisionOnlyCount: number;
    readonly nativeOnlyCount: number;
    readonly unknownOccurrenceCount: number;
    readonly overlapCounts: Readonly<Record<ThreeWayOverlapClass, number>>;
  };
  readonly occurrences: readonly ThreeWayOccurrenceAssessment[];
  readonly gaps: readonly ThreeWayGap[];
  readonly reportSha256: string;
}

export interface ThreeWayDifferentialReport {
  readonly reportVersion: 1;
  readonly reportKind: "CALCITE_NATIVE_THREE_WAY_NET_VALUE_GATE";
  readonly productionProviderDecision: "VALIDATION_ONLY";
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly nativeSemanticFallback: false;
    readonly productionIntegrationPerformed: false;
    readonly provenUnrelatedEnabled: false;
  };
  readonly taskIds: readonly string[];
  readonly decision:
    | "CALCITE_NET_INCREMENTAL_VALUE_PROVEN"
    | "CALCITE_INCREMENTAL_VALUE_CANDIDATE_ONLY"
    | "NO_NET_INCREMENTAL_VALUE_OBSERVED"
    | "INCONCLUSIVE";
  readonly summary: {
    readonly evaluatedCaseCount: number;
    readonly notEvaluatedCaseCount: number;
    readonly physicalReadOccurrenceCount: number;
    readonly calciteOnlyCount: number;
    readonly calciteOnlyCandidateCount: number;
    readonly calciteOccurrencePrecisionOnlyCount: number;
    readonly nativeOnlyCount: number;
  };
  readonly cases: readonly ThreeWayCaseReport[];
  readonly reportSha256: string;
}

export interface ThreeWayGap {
  readonly gapId: string;
  readonly code:
    | "ROOT_WRITE_NOT_UNIQUE"
    | "ROOT_STATEMENT_NOT_UNIQUE"
    | "SOURCE_IDENTITY_MISSING"
    | "PHYSICAL_READ_IDENTITY_INCOMPLETE"
    | "FIELD_VALUE_READ_NOT_FOUND"
    | "FIELD_VALUE_OCCURRENCE_AMBIGUOUS"
    | "CONTROL_RELATION_MISSING"
    | "CONTROL_READ_NOT_FOUND"
    | "CONTROL_OCCURRENCE_AMBIGUOUS"
    | "CONTROL_SCOPE_UNRESOLVED"
    | "CALCITE_INPUT_IDENTITY_MISMATCH"
    | "CALCITE_READ_OCCURRENCE_MISSING";
  readonly message: string;
  readonly subjectRefs: readonly string[];
}

export interface ThreeWayCaseInput {
  readonly taskId: string;
  readonly fieldLineage: unknown;
  readonly relationNodes: readonly unknown[];
  readonly relationEdges: readonly unknown[];
  readonly outputBindings: readonly unknown[];
  readonly statements: readonly unknown[];
  readonly sourceArtifact: unknown;
  readonly calcite?: {
    readonly report: CalciteImpactValueReport;
    readonly originalSqlSha256: string;
  };
  readonly calciteNotEvaluated?: {
    readonly reasonCode: string;
  };
}

interface PhysicalReadOccurrence {
  readonly readOccurrenceId: string;
  readonly relationId: string;
  readonly qualifiedPhysicalTable: string;
  readonly binding?: string;
  readonly sourceSpan: { readonly start: number; readonly end: number };
  readonly identityKind: "EXPLICIT" | "LEGACY_RELATION_SPAN";
}

interface MutableEvidence {
  status: EvidenceStatus;
  coarseIdentityObserved: boolean;
  readonly evidenceRefs: Set<string>;
  readonly detailRefs: Set<string>;
  readonly gapRefs: Set<string>;
  readonly labels: Set<string>;
}

const OVERLAP_CLASSES: readonly ThreeWayOverlapClass[] = [
  "ABC",
  "AB",
  "AC",
  "BC",
  "A_ONLY",
  "B_ONLY",
  "C_ONLY",
  "NONE",
  "UNKNOWN",
];

export function buildThreeWayCaseReport(
  input: ThreeWayCaseInput,
): ThreeWayCaseReport {
  const artifact = requiredRecord(input.fieldLineage, "field-lineage artifact");
  const request = record(artifact.request) ?? {};
  const rootNodeIds = new Set(strings(artifact.rootNodeIds));
  const nodes = new Map(
    records(artifact.nodes)
      .map((node) => [text(node.nodeId), node] as const)
      .filter(
        (item): item is readonly [string, JsonRecord] => item[0] !== null,
      ),
  );
  const rootWrites = strings(request.rootWriteObservationIds);
  const matchingBindings = input.outputBindings
    .map(record)
    .filter((item): item is JsonRecord => item !== null)
    .filter(
      (item) =>
        text(item.task_id) === input.taskId &&
        rootWrites.includes(text(item.write_observation_id) ?? ""),
    );
  const statementIds = unique(
    matchingBindings.map((item) => text(item.statement_id)).filter(isString),
  );
  const gaps = new Map<string, ThreeWayGap>();
  if (rootWrites.length !== 1) {
    addGap(
      gaps,
      makeGap(
        "ROOT_WRITE_NOT_UNIQUE",
        input.taskId,
        "The field-lineage request must identify exactly one target write observation.",
        rootWrites,
      ),
    );
  }
  if (statementIds.length !== 1) {
    addGap(
      gaps,
      makeGap(
        "ROOT_STATEMENT_NOT_UNIQUE",
        input.taskId,
        "The target write bindings must resolve to exactly one statement.",
        statementIds,
      ),
    );
  }
  const rootStatementId = statementIds[0];
  const statementOrdinal = rootStatementId
    ? statementOrdinalOf(rootStatementId)
    : undefined;
  const rootStatements = input.statements
    .map(record)
    .filter((item): item is JsonRecord => item !== null)
    .filter((item) => text(item.statement_id) === rootStatementId);
  const rawRootSql =
    rootStatements.length === 1 &&
    typeof rootStatements[0]!.raw_sql === "string"
      ? rootStatements[0]!.raw_sql
      : null;
  const sqlSha256Candidates = rawRootSql
    ? unique([sha256(rawRootSql), sha256(rawRootSql.replace(/\s*;\s*$/, ""))])
    : [];
  const sqlSha256 = sqlSha256Candidates[0];
  if (!sqlSha256) {
    addGap(
      gaps,
      makeGap(
        "SOURCE_IDENTITY_MISSING",
        input.taskId,
        "Machine Facts must expose exactly one raw SQL record for the target statement.",
        [rootStatementId ?? input.taskId],
      ),
    );
  }

  const relationNodes = input.relationNodes
    .map(record)
    .filter((item): item is JsonRecord => item !== null);
  const relationsById = new Map(
    relationNodes
      .map((item) => [text(item.relation_id), item] as const)
      .filter(
        (item): item is readonly [string, JsonRecord] => item[0] !== null,
      ),
  );
  const reads = rootStatementId
    ? physicalReads(relationNodes, rootStatementId, gaps)
    : [];
  const readsById = new Map(reads.map((item) => [item.readOccurrenceId, item]));
  const readsByRelationId = new Map(
    reads.map((item) => [item.relationId, item]),
  );
  const evidence = new Map(
    reads.map((item) => [
      item.readOccurrenceId,
      {
        field: mutableEvidence(),
        native: mutableEvidence(),
      },
    ]),
  );

  mapFieldValueEvidence({
    taskId: input.taskId,
    artifact,
    rootNodeIds,
    nodes,
    reads,
    evidence,
    gaps,
  });
  const incoming = incomingRelations(input.relationEdges, rootStatementId);
  mapNativeIndirectEvidence({
    artifact,
    rootNodeIds,
    relationsById,
    reads,
    readsByRelationId,
    incoming,
    evidence,
    gaps,
  });

  const rootExact =
    rootWrites.length === 1 &&
    rootStatementId !== undefined &&
    statementOrdinal !== undefined &&
    sqlSha256 !== undefined;
  const fieldArtifactStatus = text(artifact.overallStatus) ?? "UNKNOWN";
  const fieldMappingGap = [...gaps.values()].some((item) =>
    ["FIELD_VALUE_READ_NOT_FOUND", "FIELD_VALUE_OCCURRENCE_AMBIGUOUS"].includes(
      item.code,
    ),
  );
  const nativeMappingGap = [...gaps.values()].some((item) =>
    [
      "CONTROL_RELATION_MISSING",
      "CONTROL_READ_NOT_FOUND",
      "CONTROL_OCCURRENCE_AMBIGUOUS",
      "CONTROL_SCOPE_UNRESOLVED",
    ].includes(item.code),
  );
  const artifactGaps = records(artifact.gaps);
  const localPartialExplained = artifactGaps.every(
    (item) => text(item.reasonCode) === "CROSS_TASK_BRIDGE_EVIDENCE_INCOMPLETE",
  );
  const limits = record(artifact.limits) ?? {};
  const rootNodesConfirmed = [...rootNodeIds].every(
    (nodeId) => text(nodes.get(nodeId)?.evidenceStatus) === "CONFIRMED",
  );
  const rootControls = records(artifact.rowsetControls).filter((item) =>
    rootNodeIds.has(text(item.nodeId) ?? ""),
  );
  const rootControlsCurrent = rootControls.every(
    (item) =>
      text(item.relationId) !== null &&
      text(item.evidenceStatus) === "CONFIRMED",
  );
  const rootLocalArtifactCurrent =
    limits.truncated !== true &&
    rootNodesConfirmed &&
    (fieldArtifactStatus === "COMPLETE" ||
      (artifactGaps.length > 0 && localPartialExplained));
  const fieldCoverageComplete =
    rootExact && rootLocalArtifactCurrent && !fieldMappingGap;
  const nativeCoverageComplete =
    rootExact &&
    rootLocalArtifactCurrent &&
    rootControlsCurrent &&
    !nativeMappingGap;
  const calciteIdentityExact =
    input.calcite !== undefined &&
    rootExact &&
    sqlSha256Candidates.includes(input.calcite.originalSqlSha256) &&
    input.calcite.report.input.sqlSourceId === rootStatementId &&
    input.calcite.report.input.statementOrdinal === statementOrdinal &&
    input.calcite.report.root.status === "EXACT";
  if (input.calcite && !calciteIdentityExact) {
    addGap(
      gaps,
      makeGap(
        "CALCITE_INPUT_IDENTITY_MISMATCH",
        input.taskId,
        "Calcite and Native artifacts do not share an exact SQL/root identity.",
        [
          rootStatementId ?? "UNKNOWN_ROOT_STATEMENT",
          input.calcite.report.input.sqlSourceId,
          ...(sqlSha256Candidates.length > 0
            ? sqlSha256Candidates
            : ["UNKNOWN_NATIVE_SQL_SHA"]),
          input.calcite.originalSqlSha256,
        ],
      ),
    );
  }
  const calciteByOccurrence = calciteIdentityExact
    ? new Map(
        input
          .calcite!.report.reads.filter(
            (item) => item.nativeRelationOccurrenceId !== undefined,
          )
          .map((item) => [item.nativeRelationOccurrenceId!, item]),
      )
    : new Map<string, ReadImpactValueAssessment>();
  if (calciteIdentityExact) {
    for (const read of input.calcite!.report.reads) {
      const occurrenceId = read.nativeRelationOccurrenceId;
      if (occurrenceId && !readsById.has(occurrenceId)) {
        addGap(
          gaps,
          makeGap(
            "CALCITE_READ_OCCURRENCE_MISSING",
            occurrenceId,
            "Calcite read does not match the Native physical-read universe for the target statement.",
            [occurrenceId, read.relationId],
          ),
        );
      }
    }
  }

  const occurrences = reads.map((read): ThreeWayOccurrenceAssessment => {
    const item = evidence.get(read.readOccurrenceId)!;
    const field = freezeEvidence(item.field);
    const native = freezeEvidence(item.native);
    const calciteRead = calciteByOccurrence.get(read.readOccurrenceId);
    const calcite = calciteEvidence(
      calciteRead,
      input.calcite !== undefined,
      calciteIdentityExact,
    );
    const overlapClass = overlap(field.status, native.status, calcite.status);
    const calciteIndirect = calcite.indirectChannels.length > 0;
    const calciteIncrementalValue = !input.calcite
      ? "NOT_EVALUATED"
      : calciteIndirect &&
          !positive(field.status) &&
          !positive(native.status) &&
          (field.coarseIdentityObserved || native.coarseIdentityObserved)
        ? "OCCURRENCE_PRECISION_ONLY"
        : calciteIndirect && !positive(field.status) && !positive(native.status)
          ? fieldCoverageComplete &&
            nativeCoverageComplete &&
            calciteIdentityExact
            ? "PROVEN_OVER_CURRENT_ARTIFACTS"
            : "CANDIDATE_NATIVE_COVERAGE_INCOMPLETE"
          : "NO";
    return {
      occurrence: {
        readOccurrenceId: read.readOccurrenceId,
        relationId: read.relationId,
        qualifiedPhysicalTable: read.qualifiedPhysicalTable,
        sourceSpan: read.sourceSpan,
        identityKind: read.identityKind,
      },
      fieldValue: {
        ...field,
        physicalFields: sorted(item.field.labels),
      },
      nativeIndirect: {
        ...native,
        controlTypes: sorted(item.native.labels),
      },
      calcite,
      overlapClass,
      calciteIncrementalValue,
    };
  });
  const overlapCounts = Object.fromEntries(
    OVERLAP_CLASSES.map((value) => [
      value,
      occurrences.filter((item) => item.overlapClass === value).length,
    ]),
  ) as Record<ThreeWayOverlapClass, number>;
  const calciteOnlyCount = occurrences.filter(
    (item) => item.calciteIncrementalValue === "PROVEN_OVER_CURRENT_ARTIFACTS",
  ).length;
  const calciteOnlyCandidateCount = occurrences.filter(
    (item) =>
      item.calciteIncrementalValue === "CANDIDATE_NATIVE_COVERAGE_INCOMPLETE",
  ).length;
  const calciteOccurrencePrecisionOnlyCount = occurrences.filter(
    (item) => item.calciteIncrementalValue === "OCCURRENCE_PRECISION_ONLY",
  ).length;
  const calciteEvaluationStatus: ThreeWayCaseReport["coverage"]["calciteEvaluationStatus"] =
    !input.calcite
      ? "NOT_EVALUATED"
      : calciteIdentityExact && input.calcite.report.gaps.length === 0
        ? "EVALUATED"
        : "PARTIAL";
  const reportWithoutHash = {
    reportVersion: 1 as const,
    reportKind: "CALCITE_NATIVE_THREE_WAY_CASE" as const,
    taskId: input.taskId,
    root: rootExact
      ? {
          status: "EXACT" as const,
          writeObservationId: rootWrites[0]!,
          sqlSourceId: rootStatementId!,
          statementOrdinal: statementOrdinal!,
          sqlSha256: sqlSha256!,
        }
      : { status: "UNKNOWN" as const },
    coverage: {
      fieldLineageArtifactStatus: fieldArtifactStatus,
      fieldValueOccurrenceCoverageComplete: fieldCoverageComplete,
      nativeIndirectOccurrenceCoverageComplete: nativeCoverageComplete,
      calciteEvaluationStatus,
      ...(!input.calcite
        ? {
            calciteReasonCode:
              input.calciteNotEvaluated?.reasonCode ??
              "CALCITE_REPORT_NOT_AVAILABLE",
          }
        : {}),
    },
    summary: {
      physicalReadOccurrenceCount: occurrences.length,
      fieldValuePositiveCount: occurrences.filter((item) =>
        positive(item.fieldValue.status),
      ).length,
      nativeIndirectPositiveCount: occurrences.filter((item) =>
        positive(item.nativeIndirect.status),
      ).length,
      calcitePositiveCount: occurrences.filter((item) =>
        positive(item.calcite.status),
      ).length,
      calciteIndirectPositiveCount: occurrences.filter(
        (item) => item.calcite.indirectChannels.length > 0,
      ).length,
      calciteOnlyCount,
      calciteOnlyCandidateCount,
      calciteOccurrencePrecisionOnlyCount,
      nativeOnlyCount: occurrences.filter(
        (item) =>
          positive(item.nativeIndirect.status) &&
          item.calcite.status === "NOT_OBSERVED",
      ).length,
      unknownOccurrenceCount: occurrences.filter((item) =>
        [
          item.fieldValue.status,
          item.nativeIndirect.status,
          item.calcite.status,
        ].includes("UNKNOWN"),
      ).length,
      overlapCounts,
    },
    occurrences: occurrences.sort((left, right) =>
      left.occurrence.readOccurrenceId.localeCompare(
        right.occurrence.readOccurrenceId,
      ),
    ),
    gaps: [...gaps.values()].sort((left, right) =>
      left.gapId.localeCompare(right.gapId),
    ),
  };
  return Object.freeze({
    ...reportWithoutHash,
    reportSha256: sha256(canonicalJson(reportWithoutHash)),
  });
}

export function buildThreeWayDifferentialReport(
  cases: readonly ThreeWayCaseReport[],
): ThreeWayDifferentialReport {
  const ordered = [...cases].sort((left, right) =>
    left.taskId.localeCompare(right.taskId),
  );
  const calciteOnlyCount = sum(
    ordered.map((item) => item.summary.calciteOnlyCount),
  );
  const candidateCount = sum(
    ordered.map((item) => item.summary.calciteOnlyCandidateCount),
  );
  const evaluated = ordered.filter(
    (item) => item.coverage.calciteEvaluationStatus !== "NOT_EVALUATED",
  ).length;
  const withoutHash = {
    reportVersion: 1 as const,
    reportKind: "CALCITE_NATIVE_THREE_WAY_NET_VALUE_GATE" as const,
    productionProviderDecision: "VALIDATION_ONLY" as const,
    safety: {
      canonicalArtifactsWritten: false as const,
      nativeSemanticFallback: false as const,
      productionIntegrationPerformed: false as const,
      provenUnrelatedEnabled: false as const,
    },
    taskIds: ordered.map((item) => item.taskId),
    decision:
      calciteOnlyCount > 0
        ? ("CALCITE_NET_INCREMENTAL_VALUE_PROVEN" as const)
        : candidateCount > 0
          ? ("CALCITE_INCREMENTAL_VALUE_CANDIDATE_ONLY" as const)
          : evaluated > 0
            ? ("NO_NET_INCREMENTAL_VALUE_OBSERVED" as const)
            : ("INCONCLUSIVE" as const),
    summary: {
      evaluatedCaseCount: evaluated,
      notEvaluatedCaseCount: ordered.length - evaluated,
      physicalReadOccurrenceCount: sum(
        ordered.map((item) => item.summary.physicalReadOccurrenceCount),
      ),
      calciteOnlyCount,
      calciteOnlyCandidateCount: candidateCount,
      calciteOccurrencePrecisionOnlyCount: sum(
        ordered.map((item) => item.summary.calciteOccurrencePrecisionOnlyCount),
      ),
      nativeOnlyCount: sum(ordered.map((item) => item.summary.nativeOnlyCount)),
    },
    cases: ordered,
  };
  return Object.freeze({
    ...withoutHash,
    reportSha256: sha256(canonicalJson(withoutHash)),
  });
}

function mapFieldValueEvidence(input: {
  readonly taskId: string;
  readonly artifact: JsonRecord;
  readonly rootNodeIds: ReadonlySet<string>;
  readonly nodes: ReadonlyMap<string, JsonRecord>;
  readonly reads: readonly PhysicalReadOccurrence[];
  readonly evidence: Map<
    string,
    { readonly field: MutableEvidence; readonly native: MutableEvidence }
  >;
  readonly gaps: Map<string, ThreeWayGap>;
}): void {
  for (const edge of records(input.artifact.edges)) {
    if (
      text(edge.kind) !== "VALUE_FLOW" ||
      text(edge.consumerTaskId) !== input.taskId ||
      !input.rootNodeIds.has(text(edge.toNodeId) ?? "")
    )
      continue;
    const sourceNode = input.nodes.get(text(edge.fromNodeId) ?? "");
    if (!sourceNode || text(sourceNode.taskId) !== input.taskId) continue;
    const field = record(sourceNode.field);
    const table = canonicalPhysicalName(text(field?.qualifiedName) ?? "");
    const column = canonicalIdentifier(text(field?.column) ?? "");
    if (!table || !column) continue;
    const candidates = input.reads.filter(
      (read) => read.qualifiedPhysicalTable === table,
    );
    const edgeId = text(edge.edgeId) ?? `${table}.${column}`;
    if (candidates.length === 1) {
      const target = input.evidence.get(candidates[0]!.readOccurrenceId)!.field;
      mergeStatus(target, evidenceStatus(edge.evidenceStatus));
      target.detailRefs.add(`${table}.${column}`);
      target.labels.add(`${table}.${column}`);
      target.evidenceRefs.add(edgeId);
      for (const ref of strings(edge.evidenceRefs))
        target.evidenceRefs.add(ref);
      continue;
    }
    const code =
      candidates.length === 0
        ? "FIELD_VALUE_READ_NOT_FOUND"
        : "FIELD_VALUE_OCCURRENCE_AMBIGUOUS";
    const item = makeGap(
      code,
      edgeId,
      candidates.length === 0
        ? "VALUE_FLOW physical table has no exact read occurrence in the target statement."
        : "VALUE_FLOW physical table maps to multiple read occurrences and the artifact does not retain an occurrence identity.",
      [edgeId, table, ...candidates.map((read) => read.readOccurrenceId)],
    );
    addGap(input.gaps, item);
    for (const candidate of candidates) {
      const target = input.evidence.get(candidate.readOccurrenceId)!.field;
      mergeStatus(target, "UNKNOWN");
      target.coarseIdentityObserved = true;
      target.gapRefs.add(item.gapId);
      target.labels.add(`${table}.${column}`);
      target.evidenceRefs.add(edgeId);
      for (const ref of strings(edge.evidenceRefs))
        target.evidenceRefs.add(ref);
    }
  }
}

function mapNativeIndirectEvidence(input: {
  readonly artifact: JsonRecord;
  readonly rootNodeIds: ReadonlySet<string>;
  readonly relationsById: ReadonlyMap<string, JsonRecord>;
  readonly reads: readonly PhysicalReadOccurrence[];
  readonly readsByRelationId: ReadonlyMap<string, PhysicalReadOccurrence>;
  readonly incoming: ReadonlyMap<string, readonly string[]>;
  readonly evidence: Map<
    string,
    { readonly field: MutableEvidence; readonly native: MutableEvidence }
  >;
  readonly gaps: Map<string, ThreeWayGap>;
}): void {
  const controls = new Map<string, JsonRecord>();
  for (const control of records(input.artifact.rowsetControls)) {
    if (!input.rootNodeIds.has(text(control.nodeId) ?? "")) continue;
    const relationId = text(control.relationId);
    if (!relationId) {
      const item = makeGap(
        "CONTROL_SCOPE_UNRESOLVED",
        text(control.controlId) ?? "control:scope-unresolved",
        "Native rowset control does not identify a relation scope.",
        [text(control.controlId) ?? "UNKNOWN_CONTROL"],
      );
      addGap(input.gaps, item);
      continue;
    }
    const key = `${relationId}|${text(control.controlType) ?? "unknown"}`;
    if (!controls.has(key)) controls.set(key, control);
  }
  for (const control of controls.values()) {
    const relationId = text(control.relationId)!;
    const relationNode = input.relationsById.get(relationId);
    const controlId = text(control.controlId) ?? relationId;
    if (!relationNode) {
      addGap(
        input.gaps,
        makeGap(
          "CONTROL_RELATION_MISSING",
          controlId,
          "rowsetControls relationId is absent from Machine Facts.",
          [controlId, relationId],
        ),
      );
      continue;
    }
    const descendantReads = descendantPhysicalReads(
      relationId,
      input.incoming,
      input.readsByRelationId,
    );
    const refs = physicalControlRefs(record(relationNode.relation) ?? {});
    const targets = new Set<string>();
    if (refs.length === 0) {
      for (const read of descendantReads) targets.add(read.readOccurrenceId);
    } else {
      for (const ref of refs) {
        const subtreeTableCandidates = descendantReads.filter(
          (read) => read.qualifiedPhysicalTable === ref.table,
        );
        let candidates = subtreeTableCandidates;
        if (ref.qualifier)
          candidates = subtreeTableCandidates.filter(
            (read) => read.binding === ref.qualifier,
          );
        if (candidates.length === 0 && subtreeTableCandidates.length === 1)
          candidates = subtreeTableCandidates;
        if (candidates.length === 0) {
          const statementCandidates = input.reads.filter(
            (read) => read.qualifiedPhysicalTable === ref.table,
          );
          if (statementCandidates.length === 1) {
            candidates = statementCandidates;
          } else if (statementCandidates.length > 1) {
            const item = makeGap(
              "CONTROL_OCCURRENCE_AMBIGUOUS",
              `${controlId}:${ref.table}.${ref.column}:${ref.qualifier ?? "unqualified"}`,
              "Native control retains the physical table but cannot select one exact occurrence across a CTE/derived boundary.",
              [
                controlId,
                `${ref.table}.${ref.column}`,
                ...(ref.qualifier ? [`qualifier:${ref.qualifier}`] : []),
                ...statementCandidates.map((read) => read.readOccurrenceId),
              ],
            );
            addGap(input.gaps, item);
            for (const candidate of statementCandidates) {
              const target = input.evidence.get(
                candidate.readOccurrenceId,
              )!.native;
              target.coarseIdentityObserved = true;
              mergeStatus(target, "UNKNOWN");
              target.gapRefs.add(item.gapId);
              target.labels.add(text(control.controlType) ?? "unknown");
              target.detailRefs.add(relationId);
              target.evidenceRefs.add(controlId);
              for (const evidenceRef of strings(control.evidenceRefs))
                target.evidenceRefs.add(evidenceRef);
            }
            continue;
          }
        }
        if (candidates.length === 1) {
          targets.add(candidates[0]!.readOccurrenceId);
          continue;
        }
        const code =
          candidates.length === 0
            ? "CONTROL_READ_NOT_FOUND"
            : "CONTROL_OCCURRENCE_AMBIGUOUS";
        const item = makeGap(
          code,
          `${controlId}:${ref.table}.${ref.column}:${ref.qualifier ?? "unqualified"}`,
          candidates.length === 0
            ? "Control field has no exact read occurrence inside its relation subtree."
            : "Control field maps to multiple occurrences inside its relation subtree.",
          [
            controlId,
            `${ref.table}.${ref.column}`,
            ...(ref.qualifier ? [`qualifier:${ref.qualifier}`] : []),
            ...candidates.map((read) => read.readOccurrenceId),
          ],
        );
        addGap(input.gaps, item);
        for (const candidate of candidates) {
          const target = input.evidence.get(candidate.readOccurrenceId)!.native;
          target.coarseIdentityObserved = true;
          mergeStatus(target, "UNKNOWN");
          target.gapRefs.add(item.gapId);
          target.labels.add(text(control.controlType) ?? "unknown");
          target.detailRefs.add(relationId);
          target.evidenceRefs.add(controlId);
          for (const evidenceRef of strings(control.evidenceRefs))
            target.evidenceRefs.add(evidenceRef);
        }
      }
    }
    for (const occurrenceId of targets) {
      const target = input.evidence.get(occurrenceId)?.native;
      if (!target) continue;
      mergeStatus(target, evidenceStatus(control.evidenceStatus));
      target.labels.add(text(control.controlType) ?? "unknown");
      target.detailRefs.add(relationId);
      target.evidenceRefs.add(controlId);
      for (const ref of strings(control.evidenceRefs))
        target.evidenceRefs.add(ref);
    }
  }
}

function physicalReads(
  relationNodes: readonly JsonRecord[],
  statementId: string,
  gaps: Map<string, ThreeWayGap>,
): PhysicalReadOccurrence[] {
  const output: PhysicalReadOccurrence[] = [];
  for (const row of relationNodes) {
    if (
      text(row.statement_id) !== statementId ||
      canonicalIdentifier(text(row.relation_type) ?? "") !== "read"
    )
      continue;
    const relation = record(row.relation) ?? {};
    if (relation.is_cte === true) continue;
    const table = canonicalPhysicalName(text(relation.table) ?? "");
    const relationId = text(row.relation_id);
    const span = sourceSpan(row.source_span) ?? sourceSpan(relation.span);
    if (!table.includes(".") || !relationId || !span) {
      addGap(
        gaps,
        makeGap(
          "PHYSICAL_READ_IDENTITY_INCOMPLETE",
          relationId ?? text(row.source_text) ?? "read:unknown",
          "Physical read requires a qualified table, relation id and complete source span.",
          [relationId ?? "UNKNOWN_RELATION", table || "UNKNOWN_TABLE"],
        ),
      );
      continue;
    }
    const explicit =
      text(relation.read_occurrence_id) ??
      text(record(relation.read_occurrence)?.occurrence_id);
    output.push({
      readOccurrenceId: explicit ?? relationId,
      relationId,
      qualifiedPhysicalTable: table,
      ...(text(relation.binding)
        ? { binding: canonicalIdentifier(text(relation.binding)!) }
        : {}),
      sourceSpan: span,
      identityKind: explicit ? "EXPLICIT" : "LEGACY_RELATION_SPAN",
    });
  }
  return output.sort((left, right) =>
    left.readOccurrenceId.localeCompare(right.readOccurrenceId),
  );
}

function incomingRelations(
  relationEdges: readonly unknown[],
  statementId: string | undefined,
): ReadonlyMap<string, readonly string[]> {
  const output = new Map<string, string[]>();
  if (!statementId) return output;
  for (const edge of relationEdges.map(record)) {
    if (!edge || text(edge.statement_id) !== statementId) continue;
    const from = text(edge.from_relation_id);
    const to = text(edge.to_relation_id);
    if (!from || !to) continue;
    const values = output.get(to) ?? [];
    values.push(from);
    output.set(to, values);
  }
  return new Map(
    [...output].map(([key, values]) => [key, unique(values).sort()]),
  );
}

function descendantPhysicalReads(
  relationId: string,
  incoming: ReadonlyMap<string, readonly string[]>,
  readsByRelationId: ReadonlyMap<string, PhysicalReadOccurrence>,
): PhysicalReadOccurrence[] {
  const visited = new Set<string>();
  const frontier = [relationId];
  const output = new Map<string, PhysicalReadOccurrence>();
  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const read = readsByRelationId.get(current);
    if (read) output.set(read.readOccurrenceId, read);
    frontier.push(...(incoming.get(current) ?? []));
  }
  return [...output.values()].sort((left, right) =>
    left.readOccurrenceId.localeCompare(right.readOccurrenceId),
  );
}

function physicalControlRefs(value: JsonRecord): readonly {
  readonly table: string;
  readonly column: string;
  readonly qualifier?: string;
}[] {
  const refs: {
    table: string;
    column: string;
    qualifier?: string;
  }[] = [];
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    const item = record(candidate);
    if (!item) return;
    const qualifier = canonicalIdentifier(text(item.qualifier) ?? "");
    if (Array.isArray(item.physical)) {
      for (const raw of item.physical) {
        const physical = record(raw);
        const table = canonicalPhysicalName(text(physical?.table) ?? "");
        const column = canonicalIdentifier(text(physical?.column) ?? "");
        if (table && column)
          refs.push({
            table,
            column,
            ...(qualifier ? { qualifier } : {}),
          });
      }
    }
    for (const [key, child] of Object.entries(item)) {
      if (key !== "physical") visit(child);
    }
  };
  visit(value);
  const byField = new Map<string, typeof refs>();
  for (const ref of refs) {
    const key = `${ref.table}.${ref.column}`;
    const values = byField.get(key) ?? [];
    values.push(ref);
    byField.set(key, values);
  }
  const normalized: typeof refs = [];
  for (const values of byField.values()) {
    const qualified = values.filter((item) => item.qualifier);
    const selected = qualified.length > 0 ? qualified : values;
    for (const item of selected) normalized.push(item);
  }
  return uniqueBy(
    normalized,
    (item) => `${item.table}.${item.column}|${item.qualifier ?? ""}`,
  ).sort((left, right) =>
    `${left.table}.${left.column}|${left.qualifier ?? ""}`.localeCompare(
      `${right.table}.${right.column}|${right.qualifier ?? ""}`,
    ),
  );
}

function calciteEvidence(
  read: ReadImpactValueAssessment | undefined,
  reportAvailable: boolean,
  identityExact: boolean,
): ThreeWayOccurrenceAssessment["calcite"] {
  if (!reportAvailable || !identityExact || !read) {
    return {
      status:
        reportAvailable && identityExact ? "NOT_EVALUATED" : "NOT_EVALUATED",
      coarseIdentityObserved: false,
      evidenceRefs: [],
      detailRefs: [],
      gapRefs: read?.gapRefs ?? [],
      directFieldValue: false,
      indirectChannels: [],
      witnessDigests: [],
    };
  }
  const witnesses = [
    ...(read.directFieldValueWitness ? [read.directFieldValueWitness] : []),
    ...read.indirectWitnesses,
  ];
  const status: EvidenceStatus =
    witnesses.length > 0
      ? "CONFIRMED"
      : read.status === "UNKNOWN"
        ? "UNKNOWN"
        : "NOT_OBSERVED";
  return {
    status,
    coarseIdentityObserved: false,
    evidenceRefs: sorted(witnesses.flatMap((item) => item.evidenceRefs)),
    detailRefs: sorted(witnesses.flatMap((item) => item.dependencyIds)),
    gapRefs: sorted(read.gapRefs),
    directFieldValue: read.directFieldValueWitness !== undefined,
    indirectChannels: unique(
      read.indirectWitnesses.map((item) => item.channel),
    ).sort(),
    witnessDigests: sorted(witnesses.map((item) => item.planWitnessSha256)),
  };
}

function overlap(
  field: EvidenceStatus,
  native: EvidenceStatus,
  calcite: EvidenceStatus,
): ThreeWayOverlapClass {
  const a = positive(field);
  const b = positive(native);
  const c = positive(calcite);
  if (a && b && c) return "ABC";
  if (a && b) return "AB";
  if (a && c) return "AC";
  if (b && c) return "BC";
  if (a) return "A_ONLY";
  if (b) return "B_ONLY";
  if (c) return "C_ONLY";
  if ([field, native, calcite].includes("UNKNOWN")) return "UNKNOWN";
  return "NONE";
}

function mutableEvidence(): MutableEvidence {
  return {
    status: "NOT_OBSERVED",
    coarseIdentityObserved: false,
    evidenceRefs: new Set(),
    detailRefs: new Set(),
    gapRefs: new Set(),
    labels: new Set(),
  };
}

function freezeEvidence(value: MutableEvidence): ThreeWayEvidenceSummary {
  return {
    status: value.status,
    coarseIdentityObserved: value.coarseIdentityObserved,
    evidenceRefs: sorted(value.evidenceRefs),
    detailRefs: sorted(value.detailRefs),
    gapRefs: sorted(value.gapRefs),
  };
}

function mergeStatus(target: MutableEvidence, incoming: EvidenceStatus): void {
  const rank: Record<EvidenceStatus, number> = {
    NOT_EVALUATED: 0,
    NOT_OBSERVED: 1,
    UNKNOWN: 2,
    CONDITIONAL: 3,
    CONFIRMED: 4,
  };
  if (rank[incoming] > rank[target.status]) target.status = incoming;
}

function evidenceStatus(value: unknown): EvidenceStatus {
  const status = text(value);
  if (status === "CONFIRMED") return "CONFIRMED";
  if (status === "PROVISIONAL_LEGACY") return "CONDITIONAL";
  return "UNKNOWN";
}

function positive(status: EvidenceStatus): boolean {
  return status === "CONFIRMED" || status === "CONDITIONAL";
}

function makeGap(
  code: ThreeWayGap["code"],
  subject: string,
  message: string,
  subjectRefs: readonly string[],
): ThreeWayGap {
  return {
    gapId: `three-way-gap:${code.toLowerCase()}:${sha256(`${subject}|${subjectRefs.join("|")}`).slice(0, 16)}`,
    code,
    message,
    subjectRefs: unique(subjectRefs).sort(),
  };
}

function addGap(target: Map<string, ThreeWayGap>, item: ThreeWayGap): void {
  if (!target.has(item.gapId)) target.set(item.gapId, item);
}

function sourceSpan(
  value: unknown,
): { readonly start: number; readonly end: number } | undefined {
  const item = record(value);
  return typeof item?.start === "number" &&
    Number.isInteger(item.start) &&
    typeof item.end === "number" &&
    Number.isInteger(item.end) &&
    item.end >= item.start
    ? { start: item.start, end: item.end }
    : undefined;
}

function statementOrdinalOf(value: string): number | undefined {
  const match = value.match(/:statement:(\d+)$/);
  if (!match) return undefined;
  const ordinal = Number(match[1]);
  return Number.isInteger(ordinal) ? ordinal : undefined;
}

function canonicalPhysicalName(value: string): string {
  return value
    .trim()
    .replace(/[`"\[\]]/g, "")
    .split(".")
    .map(canonicalIdentifier)
    .filter(Boolean)
    .join(".");
}

function canonicalIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function requiredRecord(value: unknown, label: string): JsonRecord {
  const item = record(value);
  if (!item) throw new Error(`${label} must be an object`);
  return item;
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(isString) : [];
}

function isString(value: string | null): value is string {
  return value !== null;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const output = new Map<string, T>();
  for (const value of values)
    if (!output.has(key(value))) output.set(key(value), value);
  return [...output.values()];
}

function sorted(values: Iterable<string>): string[] {
  return unique([...values]).sort();
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function argument(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`missing ${name}`);
  return value;
}

function main(): void {
  const dataRoot = resolve(argument("--data-root")!);
  const taskIds = unique(
    argument("--task-ids")!
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const stagingRoot = resolve(
    argument("--calcite-staging-root", false) ??
      CALCITE_PROVIDER_POC_STAGING_ROOT,
  );
  const cases = taskIds.map((taskId) => {
    const artifactRoot = join(dataRoot, "artifacts", "tasks", taskId);
    const bundleRoot = join(
      dataRoot,
      "field-facts",
      "registry",
      "tasks",
      taskId,
      "bundle",
    );
    const calciteRoot = join(stagingRoot, `real-${taskId}`);
    let calcite: ThreeWayCaseInput["calcite"];
    let calciteNotEvaluated: ThreeWayCaseInput["calciteNotEvaluated"];
    const statusPath = join(calciteRoot, "case-status.json");
    const status = existsSync(statusPath) ? record(readJson(statusPath)) : null;
    if (status && text(status.status) === "NOT_EVALUATED") {
      calciteNotEvaluated = {
        reasonCode: text(status.reasonCode) ?? "CALCITE_REPORT_NOT_AVAILABLE",
      };
    } else
      try {
        const report = readJson(
          join(calciteRoot, "impact-value-report.json"),
        ) as CalciteImpactValueReport;
        const manifest = requiredRecord(
          readJson(join(calciteRoot, "input-manifest.json")),
          "Calcite input manifest",
        );
        const evidenceRecord = requiredRecord(
          manifest.evidence,
          "Calcite input manifest evidence",
        );
        const originalSqlSha256 = text(evidenceRecord.sqlSha256);
        if (!originalSqlSha256)
          throw new Error("Calcite input manifest sqlSha256 missing");
        calcite = { report, originalSqlSha256 };
      } catch {
        try {
          const fallbackStatus = requiredRecord(
            readJson(join(calciteRoot, "case-status.json")),
            "Calcite case status",
          );
          calciteNotEvaluated = {
            reasonCode:
              text(fallbackStatus.reasonCode) ?? "CALCITE_REPORT_NOT_AVAILABLE",
          };
        } catch {
          calciteNotEvaluated = {
            reasonCode: "CALCITE_REPORT_NOT_AVAILABLE",
          };
        }
      }
    return buildThreeWayCaseReport({
      taskId,
      fieldLineage: readJson(join(artifactRoot, "field-lineage.json")),
      relationNodes: readJsonl(join(bundleRoot, "relation-nodes.jsonl")),
      relationEdges: readJsonl(join(bundleRoot, "relation-edges.jsonl")),
      outputBindings: readJsonl(
        join(bundleRoot, "output-field-bindings.jsonl"),
      ),
      statements: readJsonl(join(bundleRoot, "statements.jsonl")),
      sourceArtifact: readJson(join(bundleRoot, "source-artifact.json")),
      ...(calcite ? { calcite } : {}),
      ...(calciteNotEvaluated ? { calciteNotEvaluated } : {}),
    });
  });
  const report = buildThreeWayDifferentialReport(cases);
  const output = resolvePocOutputPath(
    argument("--output", false) ?? "three-way-impact-differential/report.json",
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, canonicalJson(report), "utf8");
  process.stdout.write(canonicalJson(report.summary));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

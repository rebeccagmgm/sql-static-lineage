import type { CausalSliceArtifact } from "./causal-slice-contract.ts";

const ASSESSMENT_STATUSES = [
  "CONFIRMED_RELATED",
  "CONDITIONAL_RELATED",
  "PROVEN_UNRELATED",
  "UNKNOWN",
] as const;

const DETAIL_LIMIT = 200;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => compareText(key(left), key(right)));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function value(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}

function list(values: readonly string[]): string {
  if (values.length === 0) return "-";
  const visible = values.slice(0, DETAIL_LIMIT);
  const suffix =
    values.length > visible.length
      ? ` ... omitted=${values.length - visible.length}`
      : "";
  return `${visible.join(", ")}${suffix}`;
}

function detailCount(total: number, showing: number): string {
  return `total=${total} showing=${showing} omitted=${total - showing}`;
}

function bounded<T>(
  values: readonly T[],
  key?: (value: T) => string,
): { items: T[]; total: number } {
  const ordered = key ? sorted(values, key) : [...values];
  return { items: ordered.slice(0, DETAIL_LIMIT), total: ordered.length };
}

function subject(subject: {
  readonly subjectKind: string;
  readonly physicalFieldId?: string;
  readonly relationOccurrenceId?: string;
}): string {
  return subject.subjectKind === "PHYSICAL_FIELD"
    ? `PHYSICAL_FIELD:${value(subject.physicalFieldId)}`
    : `RELATION_OCCURRENCE:${value(subject.relationOccurrenceId)}`;
}

function table(
  branch: CausalSliceArtifact["candidateUniverse"]["branches"][number],
): string {
  if (!branch.table) return "-";
  return [
    branch.table.platform,
    branch.table.dataSource,
    branch.table.qualifiedName,
    branch.table.stableTableId,
    branch.table.identityStatus,
  ]
    .map(value)
    .join("/");
}

function occurrence(
  branch: CausalSliceArtifact["candidateUniverse"]["branches"][number],
): string {
  if (!branch.readOccurrence) return "-";
  return [
    branch.readOccurrence.occurrenceId,
    branch.readOccurrence.readRelationId,
    `statement=${branch.readOccurrence.statementIndex}`,
    `path=${list(branch.readOccurrence.relationPath)}`,
  ].join(";");
}

function proofRefs(
  ids: readonly string[],
  proofs: ReadonlyMap<string, string>,
): string {
  return list(
    ids.map((id) => `${id}${proofs.has(id) ? ` {${proofs.get(id)}}` : ""}`),
  );
}

function assessmentLine(
  assessment: CausalSliceArtifact["assessments"][number],
  branches: ReadonlyMap<
    string,
    CausalSliceArtifact["candidateUniverse"]["branches"][number]
  >,
  positiveProofs: ReadonlyMap<
    string,
    CausalSliceArtifact["positiveProofs"][number]
  >,
  negativeProofs: ReadonlyMap<
    string,
    CausalSliceArtifact["negativeProofs"][number]
  >,
  gaps: ReadonlyMap<string, CausalSliceArtifact["assessmentGaps"][number]>,
): string[] {
  const branch = branches.get(assessment.candidateBranchId);
  const lines = [
    `    - assessment=${assessment.assessmentId} pair=${assessment.pairId} reason=${assessment.reasonCode}`,
    `      candidate=${assessment.candidateBranchId} kind=${value(branch?.branchKind)} producerTask=${value(branch?.producerTaskId)} consumerTask=${value(branch?.consumerTaskId)} rootTask=${value(branch?.rootTaskId)}`,
    `      table=${branch ? table(branch) : "MISSING_BRANCH"}`,
    `      occurrence=${branch ? occurrence(branch) : "MISSING_BRANCH"}`,
    `      producerRole=${value(branch?.producerRole)} boundary=${value(branch?.boundaryReason)}`,
    `      candidateEvidence=${list(branch?.evidenceRefs.map((item) => item.evidenceRefId) ?? [])} candidateGaps=${list(branch?.gapRefs ?? [])}`,
    `      positiveProofRefs=${proofRefs(assessment.positiveProofIds, new Map([...positiveProofs].map(([id, proof]) => [id, `${proof.reasonCode};certainty=${proof.pathCertainty};paths=${list(proof.pathIds)};edges=${list(proof.edgeIds)};evidence=${list(proof.evidenceRefs)}`])))} `,
    `      negativeProofRefs=${proofRefs(
      assessment.negativeProofIds,
      new Map(
        [...negativeProofs].map(([id, proof]) => [
          id,
          `${proof.reasonCode};evidence=${list(proof.evidenceRefs)};source=${value(proof.sourceNegativeProofId)};obligations=${proof.checkedObligations
            .slice(0, DETAIL_LIMIT)
            .map((item) => `${item.kind}:${list(item.evidenceRefs)}`)
            .join(
              "|",
            )}${proof.checkedObligations.length > DETAIL_LIMIT ? ` ... omitted=${proof.checkedObligations.length - DETAIL_LIMIT}` : ""}`,
        ]),
      ),
    )} `,
    `      unknownGaps=${proofRefs(assessment.gapRefs, new Map([...gaps].map(([id, gap]) => [id, `${gap.reasonCode};evidence=${list(gap.evidenceRefs)}`])))} `,
  ];
  return lines.map((line) => line.trimEnd());
}

function formatAssessments(artifact: CausalSliceArtifact): string[] {
  const branches = new Map(
    artifact.candidateUniverse.branches.map((branch) => [
      branch.candidateBranchId,
      branch,
    ]),
  );
  const positiveProofs = new Map(
    artifact.positiveProofs.map((proof) => [proof.proofId, proof]),
  );
  const negativeProofs = new Map(
    artifact.negativeProofs.map((proof) => [proof.proofId, proof]),
  );
  const gaps = new Map(artifact.assessmentGaps.map((gap) => [gap.gapId, gap]));
  const allCriteria = sorted(
    artifact.rootCriteria,
    (criterion) => criterion.rootCriterionId,
  );
  const criteria = allCriteria.slice(0, DETAIL_LIMIT);
  const statusCounts = new Map<string, number>();
  for (const assessment of artifact.assessments)
    statusCounts.set(
      assessment.status,
      (statusCounts.get(assessment.status) ?? 0) + 1,
    );
  const lines = [
    "ASSESSMENTS_BY_ROOT_CRITERION",
    `  ROOT_CRITERIA ${detailCount(allCriteria.length, criteria.length)}`,
    `  STATUS_COUNTS ${ASSESSMENT_STATUSES.map((status) => `${status}=${statusCounts.get(status) ?? 0}`).join(" ")}`,
  ];
  const remainingByStatus = new Map<string, number>(
    ASSESSMENT_STATUSES.map((status) => [status, DETAIL_LIMIT]),
  );
  let remainingTraversalGaps = DETAIL_LIMIT;

  for (const criterion of criteria) {
    const rootCriterionId = criterion.rootCriterionId;
    const traversalRoot = artifact.traversal.roots.find(
      (item) => item.rootCriterionId === rootCriterionId,
    );
    const nestedCriterion = traversalRoot?.root.rootCriterion ?? criterion;
    lines.push(
      `  ROOT_CRITERION ${rootCriterionId} targetField=${nestedCriterion.rootTargetFieldId} targetFieldName=${nestedCriterion.targetFieldName} writeObservation=${nestedCriterion.rootWriteObservationId} statement=${nestedCriterion.statementId} semanticScope=${value(traversalRoot?.root.semanticScope.semanticScopeId)}`,
    );
    for (const status of ASSESSMENT_STATUSES) {
      const assessments = sorted(
        artifact.assessments.filter(
          (assessment) =>
            assessment.rootCriterionId === rootCriterionId &&
            assessment.status === status,
        ),
        (assessment) =>
          `${assessment.candidateBranchId}|${assessment.assessmentId}`,
      );
      const showing = Math.min(
        assessments.length,
        remainingByStatus.get(status) ?? 0,
      );
      lines.push(
        `    ${status} (${assessments.length}) ${detailCount(assessments.length, showing)}`,
      );
      if (assessments.length === 0) lines.push("      - none");
      for (const assessment of assessments.slice(0, showing))
        lines.push(
          ...assessmentLine(
            assessment,
            branches,
            positiveProofs,
            negativeProofs,
            gaps,
          ),
        );
      remainingByStatus.set(
        status,
        (remainingByStatus.get(status) ?? 0) - showing,
      );
    }
    const traversalGaps = sorted(
      artifact.traversal.gaps.filter(
        (gap) => gap.rootCriterionId === rootCriterionId,
      ),
      (gap) => gap.gapId,
    );
    lines.push(
      `    traversalDecision value=${value(traversalRoot?.decision.valuePathCertainty)} control=${value(traversalRoot?.decision.controlPathCertainty)} valueClosed=${value(traversalRoot?.decision.valueClosed)} controlClosed=${value(traversalRoot?.decision.controlClosed)}`,
    );
    lines.push(
      `    traversalGapRefs value=${list(traversalRoot?.decision.valueGapIds ?? [])} control=${list(traversalRoot?.decision.controlGapIds ?? [])}`,
    );
    const showingTraversalGaps = Math.min(
      traversalGaps.length,
      remainingTraversalGaps,
    );
    lines.push(
      `    traversalGaps (${traversalGaps.length}) ${detailCount(traversalGaps.length, showingTraversalGaps)}`,
    );
    if (traversalGaps.length === 0) lines.push("      - none");
    for (const gap of traversalGaps.slice(0, showingTraversalGaps))
      lines.push(
        `      - ${gap.gapId} rootCriterion=${gap.rootCriterionId} semanticScope=${gap.semanticScopeId} task=${gap.taskId} frontier=${gap.frontierKind} reason=${gap.reasonCode} subject=${gap.subject ? subject(gap.subject) : "-"} occurrence=${value(gap.readOccurrenceId)} evidence=${list(gap.evidenceRefs)} blocksConfirmedCausality=${gap.blocksConfirmedCausality} blocksNegativeProof=${gap.blocksNegativeProof}`,
      );
    remainingTraversalGaps -= showingTraversalGaps;
    const pathSet = bounded(traversalRoot?.paths ?? [], (path) => path.pathId);
    lines.push(
      `    traversalPaths (${pathSet.total}) ${detailCount(pathSet.total, pathSet.items.length)}`,
    );
    if (pathSet.total === 0) lines.push("      - none");
    for (const path of pathSet.items) {
      lines.push(
        `      - ${path.pathId} rootCriterion=${path.rootCriterionId} targetField=${path.rootTargetFieldId} dependence=${path.rootDependenceKind} certainty=${path.pathCertainty}`,
      );
      for (const edge of path.edges.slice(0, DETAIL_LIMIT))
        lines.push(
          `        edge=${edge.edgeId} rootCriterion=${edge.rootCriterionId} fromScope=${edge.fromSemanticScopeId} toScope=${edge.toSemanticScopeId} ${subject(edge.fromSubject)} -> ${subject(edge.toSubject)} frontier=${edge.frontierKind} localEdge=${edge.localEdgeKind} certainty=${edge.pathCertainty} evidence=${list(edge.evidenceRefs)}`,
        );
    }
  }
  if (allCriteria.length > criteria.length)
    lines.push(
      `  ROOT_CRITERIA_OMITTED ${allCriteria.length - criteria.length}`,
    );
  return lines;
}

function formatDependencies(artifact: CausalSliceArtifact): string[] {
  const definitionSet = bounded(
    artifact.dependencies.definitions,
    (item) => item.dependencyId,
  );
  const applicationSet = bounded(
    artifact.dependencies.applications,
    (item) => item.applicationId,
  );
  const edgeSet = bounded(artifact.dependencies.edges, (item) => item.edgeId);
  const gapSet = bounded(artifact.dependencies.gaps, (item) => item.gapId);
  const definitions = definitionSet.items;
  const applications = applicationSet.items;
  const edges = edgeSet.items;
  const supportCounts = new Map<string, number>();
  for (const definition of artifact.dependencies.definitions)
    supportCounts.set(
      definition.supportStatus,
      (supportCounts.get(definition.supportStatus) ?? 0) + 1,
    );
  const supportSummary = [...supportCounts.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([status, count]) => `${status}=${count}`);
  const lines = [
    "OPERATOR_SUPPORT_AND_DEPENDENCY_SUMMARY",
    `  definitions=${definitionSet.total} applications=${applicationSet.total} edges=${edgeSet.total} gaps=${gapSet.total} support=${list(supportSummary)}`,
    `  detailLimit=${DETAIL_LIMIT}`,
    "  DEFINITIONS",
  ];
  if (definitions.length === 0) lines.push("    - none");
  for (const definition of definitions)
    lines.push(
      `    - ${definition.dependencyId} semanticScope=${value(definition.semanticScopeId)} operator=${definition.operatorKind}/${definition.operatorVariant} role=${definition.operatorRole} subject=${subject(definition.subject)} effect=${definition.effectKind} localEdge=${definition.localEdgeKind} support=${definition.supportStatus} proofRefs=${list(definition.proofRefs.map((ref) => ref.proofRefId))}`,
    );
  lines.push("  APPLICATIONS");
  if (applications.length === 0) lines.push("    - none");
  for (const application of applications)
    lines.push(
      `    - ${application.applicationId} rootCriterion=${value(application.rootCriterionId)} semanticScope=${value(application.semanticScopeId)} root=${application.rootTargetFieldId} dependency=${application.dependencyId} rootDependence=${application.rootDependenceKind} certainty=${application.pathCertainty} proofRefs=${list(application.proofRefs.map((ref) => ref.proofRefId))}`,
    );
  lines.push("  EDGES");
  if (edges.length === 0) lines.push("    - none");
  for (const edge of edges)
    lines.push(
      `    - ${edge.edgeId} rootCriterion=${value(edge.rootCriterionId)} semanticScope=${value(edge.semanticScopeId)} ${subject(edge.fromSubject)} -> ${subject(edge.toSubject)} dependency=${edge.dependencyId} rootDependence=${edge.rootDependenceKind} localEdge=${edge.localEdgeKind} certainty=${edge.pathCertainty} proofRefs=${list(edge.proofRefs.map((ref) => ref.proofRefId))}`,
    );
  lines.push("  GAPS");
  if (gapSet.items.length === 0) lines.push("    - none");
  for (const gap of gapSet.items)
    lines.push(
      `    - ${gap.gapId} rootCriterion=${value(gap.rootCriterionId)} semanticScope=${value(gap.semanticScopeId)} reason=${gap.reasonCode} relation=${value(gap.relationId)} evidence=${list(gap.evidenceRefs)} blocksConfirmedCausality=${gap.blocksConfirmedCausality} blocksNegativeProof=${gap.blocksNegativeProof}`,
    );
  lines.push(
    `  OMITTED definitions=${definitionSet.total - definitions.length} applications=${applicationSet.total - applications.length} edges=${edgeSet.total - edges.length} gaps=${gapSet.total - gapSet.items.length}`,
  );
  return lines;
}

function formatRerunSet(
  title: string,
  rerunSet: CausalSliceArtifact["rerunSets"]["minimumConfirmed"],
): string[] {
  const lines = [
    title,
    `  taskIds=${list(rerunSet.taskIds)} taskCount=${rerunSet.taskIds.length}`,
    `  entries=${rerunSet.entries.length} unresolved=${rerunSet.unresolved.length} detailLimit=${DETAIL_LIMIT}`,
  ];
  const entrySet = bounded(
    rerunSet.entries,
    (entry) => `${entry.taskId ?? ""}|${entry.unresolvedReason ?? ""}`,
  );
  const entries = entrySet.items;
  for (const entry of entries) {
    const triggerSet = bounded(
      entry.triggers,
      (trigger) =>
        `${trigger.rootCriterionId}|${trigger.candidateBranchId}|${trigger.assessmentId}`,
    );
    const triggers = triggerSet.items;
    lines.push(
      `  TASK_MAPPING task=${value(entry.taskId)} unresolvedReason=${value(entry.unresolvedReason)} triggers=${triggerSet.total} ${detailCount(triggerSet.total, triggers.length)}`,
    );
    for (const trigger of triggers)
      lines.push(
        `    - rootCriterion=${trigger.rootCriterionId} root=${trigger.rootTargetFieldId} candidate=${trigger.candidateBranchId} assessment=${trigger.assessmentId} status=${trigger.causalStatus} positiveProofRefs=${list(trigger.positiveProofIds)} negativeProofRefs=${list(trigger.negativeProofIds)} gapRefs=${list(trigger.gapRefs)}`,
      );
  }
  const unresolvedSet = bounded(
    rerunSet.unresolved,
    (entry) =>
      `${entry.unresolvedReason ?? ""}|${entry.triggers.map((trigger) => trigger.assessmentId).join("|")}`,
  );
  const unresolved = unresolvedSet.items;
  if (unresolved.length === 0) lines.push("  UNRESOLVED_TASK_MAPPINGS - none");
  for (const entry of unresolved) {
    const triggerSet = bounded(
      entry.triggers,
      (item) =>
        `${item.rootCriterionId}|${item.candidateBranchId}|${item.assessmentId}`,
    );
    lines.push(
      `  UNRESOLVED_TASK_MAPPING task=${value(entry.taskId)} reason=${value(entry.unresolvedReason)} triggers=${triggerSet.total} ${detailCount(triggerSet.total, triggerSet.items.length)}`,
    );
    for (const trigger of triggerSet.items)
      lines.push(
        `    - rootCriterion=${trigger.rootCriterionId} root=${trigger.rootTargetFieldId} candidate=${trigger.candidateBranchId} assessment=${trigger.assessmentId} status=${trigger.causalStatus} positiveProofRefs=${list(trigger.positiveProofIds)} negativeProofRefs=${list(trigger.negativeProofIds)} gapRefs=${list(trigger.gapRefs)}`,
      );
  }
  lines.push(
    `  OMITTED entries=${entrySet.total - entries.length} unresolved=${unresolvedSet.total - unresolved.length}`,
  );
  return lines;
}

/** Format only the already-built canonical causal-slice artifact. */
export function formatCausalSlice(artifact: CausalSliceArtifact): string {
  const lines = [
    `TARGET_FIELD_CAUSAL_SLICE ${artifact.schemaVersion}`,
    `artifactType=${artifact.artifactType} contentHash=${artifact.contentHash} generatedAt=${artifact.generatedAt}`,
    `request rootTask=${artifact.request.rootTaskId} rootTable=${artifact.request.rootTable} negativeProofMode=${artifact.request.negativeProofMode}`,
    `rootFields=${list(uniqueSorted(artifact.request.rootFields))} rootWriteObservationIds=${list(uniqueSorted(artifact.request.rootWriteObservationIds))}`,
    `inputFingerprints inputPack=${artifact.inputFingerprints.inputPack.length} machineFacts=${artifact.inputFingerprints.machineFacts.length} producerIndex=${artifact.inputFingerprints.producerIndex.length} tableMultiHopArtifact=${artifact.inputFingerprints.tableMultiHopArtifact.length} legacyValueEvidence=${artifact.inputFingerprints.legacyFieldLineageValueEvidence?.length ?? 0}`,
    `proofGapCounts positiveProofs=${artifact.positiveProofs.length} negativeProofs=${artifact.negativeProofs.length} assessmentGaps=${artifact.assessmentGaps.length} traversalGaps=${artifact.traversal.gaps.length} dependencyGaps=${artifact.dependencies.gaps.length}`,
    "CANDIDATE_UNIVERSE",
    `  rootTask=${artifact.candidateUniverse.rootTaskId} status=${artifact.candidateUniverse.status} branches=${artifact.candidateUniverse.branches.length} boundaryGapRefs=${list(artifact.candidateUniverse.boundaryGapRefs)}`,
    `  coverage sourceArtifactType=${artifact.candidateUniverse.coverage.sourceArtifactType} sourceCoverageStatus=${value(artifact.candidateUniverse.coverage.sourceCoverageStatus)} sourceCoverageSemantics=${value(artifact.candidateUniverse.coverage.sourceCoverageSemantics)} sourceLimitsTruncated=${artifact.candidateUniverse.coverage.sourceLimitsTruncated}`,
  ];
  const branchSet = bounded(
    artifact.candidateUniverse.branches,
    (item) => item.candidateBranchId,
  );
  lines.push(`  branchDetailLimit=${DETAIL_LIMIT}`);
  for (const branch of branchSet.items)
    lines.push(
      `  - candidate=${branch.candidateBranchId} kind=${branch.branchKind} producerTask=${value(branch.producerTaskId)} consumerTask=${value(branch.consumerTaskId)} rootTask=${value(branch.rootTaskId)} table=${table(branch)} occurrence=${occurrence(branch)} boundary=${value(branch.boundaryReason)}`,
    );
  lines.push(
    `  branchesDetail ${detailCount(branchSet.total, branchSet.items.length)}`,
  );
  lines.push(...formatAssessments(artifact));
  lines.push(...formatDependencies(artifact));
  lines.push(
    "LIMITS",
    `  maxDepth=${artifact.limits.maxDepth}`,
    `  VALUE maxStates=${artifact.limits.value.maxStates} maxPaths=${artifact.limits.value.maxPaths} truncated=${artifact.limits.value.truncated} reasons=${list(artifact.limits.value.reasons)}`,
    `  CONTROL maxStates=${artifact.limits.control.maxStates} maxPaths=${artifact.limits.control.maxPaths} truncated=${artifact.limits.control.truncated} reasons=${list(artifact.limits.control.reasons)}`,
    "QUALITY_METRICS",
    `  confirmedEvidenceClosureRate=${artifact.qualityMetrics.confirmedEvidenceClosureRate}`,
    `  closedDecisionCoverage=${artifact.qualityMetrics.closedDecisionCoverage.numerator}/${artifact.qualityMetrics.closedDecisionCoverage.denominator} rate=${artifact.qualityMetrics.closedDecisionCoverage.rate}`,
    `  precision=${artifact.qualityMetrics.precision} recall=${artifact.qualityMetrics.recall}`,
    `BOUNDARIES staticSqlOnly=${artifact.boundaries.staticSqlOnly} runtimeExecution=${artifact.boundaries.runtimeExecution} dataCorrectness=${artifact.boundaries.dataCorrectness} businessAcceptance=${artifact.boundaries.businessAcceptance}`,
    ...formatRerunSet(
      "MINIMUM_CONFIRMED_RERUN_SET",
      artifact.rerunSets.minimumConfirmed,
    ),
    ...formatRerunSet(
      "CONSERVATIVE_SAFETY_RERUN_SET",
      artifact.rerunSets.conservativeSafety,
    ),
  );
  return `${lines.join("\n")}\n`;
}

export const formatCausalSliceSummary = formatCausalSlice;
export const formatTargetFieldCausalSlice = formatCausalSlice;

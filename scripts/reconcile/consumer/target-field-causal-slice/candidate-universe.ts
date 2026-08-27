import {
  canonicalJson,
  sha256,
  type JsonValue,
} from "../../../machine-facts/machine-facts-contract.ts";

type JsonRecord = Readonly<Record<string, unknown>>;

export const CANDIDATE_BRANCH_KINDS = [
  "ROOT_WRITE",
  "PHYSICAL_PRODUCER",
  "SCHEDULE_ONLY",
  "UNBOUND_READ",
  "BLOCKED_READ",
  "COVERAGE_BOUNDARY",
] as const;
export type CandidateBranchKind = (typeof CANDIDATE_BRANCH_KINDS)[number];

export type CandidateUniverseStatus =
  | "COMPLETE_OBSERVED_EVIDENCE"
  | "INCOMPLETE";

export interface CandidateReadOccurrence {
  readonly occurrenceId: string;
  readonly readRelationId: string;
  readonly statementIndex: number;
  readonly relationPath: readonly string[];
}

export interface CandidatePhysicalTable {
  readonly platform: string | null;
  readonly dataSource: string | null;
  readonly qualifiedName: string | null;
  readonly stableTableId: string | null;
  readonly identityStatus: string | null;
}

export interface CandidateEvidenceRef {
  readonly evidenceRefId: string;
  readonly source: string | null;
  readonly locator: string | null;
}

export interface CandidateBranch {
  readonly candidateBranchId: string;
  readonly branchKind: CandidateBranchKind;
  readonly rootTaskId: string;
  readonly consumerTaskId: string | null;
  readonly producerTaskId: string | null;
  readonly table: CandidatePhysicalTable | null;
  readonly readOccurrence: CandidateReadOccurrence | null;
  /** Exact root WRITE criterion; null for non-root branches. */
  readonly writeObservationId?: string | null;
  /** Evidence judgment is metadata and deliberately excluded from branch ID. */
  readonly producerRole: string | null;
  readonly evidenceRefs: readonly CandidateEvidenceRef[];
  readonly gapRefs: readonly string[];
  readonly boundaryReason: string | null;
}

export interface CandidateUniverse {
  readonly rootTaskId: string;
  readonly status: CandidateUniverseStatus;
  readonly branches: readonly CandidateBranch[];
  readonly boundaryGapRefs: readonly string[];
  readonly coverage: Readonly<{
    readonly sourceArtifactType: string;
    readonly sourceCoverageStatus: string | null;
    readonly sourceCoverageSemantics: string | null;
    readonly sourceLimitsTruncated: boolean;
  }>;
}

export interface CandidateAssessmentPair {
  readonly pairId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  /** Deliberately empty: 5.2 builds the skeleton, not a causal decision. */
  readonly assessment: null;
}

export interface CandidateUniverseProjectionInput {
  readonly rootTargetFields: readonly string[];
  readonly tableArtifact: unknown;
  readonly rootWriteObservationIds?: readonly string[];
}

export interface CandidateAssessmentPairValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integer(value: unknown): number | null {
  return Number.isSafeInteger(value) ? Number(value) : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function tableOf(value: unknown): CandidatePhysicalTable | null {
  const source = record(value);
  if (!source) return null;
  return {
    platform: text(source.platform),
    dataSource: text(source.dataSource),
    qualifiedName: text(source.qualifiedName),
    stableTableId: text(source.stableTableId),
    identityStatus: text(source.identityStatus),
  };
}

function tableIdentity(table: CandidatePhysicalTable | null): JsonValue {
  if (!table) return null;
  return {
    platform: table.platform,
    dataSource: table.dataSource,
    qualifiedName: table.qualifiedName,
    stableTableId: table.stableTableId,
    identityStatus: table.identityStatus,
  };
}

/** Physical identity is stable; resolution status is mutable evidence metadata. */
function stableTableIdentity(table: CandidatePhysicalTable | null): JsonValue {
  if (!table) return null;
  return {
    platform: table.platform,
    dataSource: table.dataSource,
    qualifiedName: table.qualifiedName,
    stableTableId: table.stableTableId,
  };
}

function tableKey(table: CandidatePhysicalTable | null): string {
  return canonicalJson(stableTableIdentity(table));
}

function occurrenceOf(value: unknown): CandidateReadOccurrence | null {
  const source = record(value);
  if (!source) return null;
  const occurrenceId = text(source.occurrenceId);
  const readRelationId = text(source.readRelationId);
  const statementIndex = integer(source.statementIndex);
  const relationPath = Array.isArray(source.relationPath)
    ? source.relationPath.filter((item): item is string => typeof item === "string")
    : [];
  if (
    occurrenceId === null ||
    readRelationId === null ||
    statementIndex === null ||
    relationPath.length === 0
  )
    return null;
  return { occurrenceId, readRelationId, statementIndex, relationPath };
}

function occurrenceIdentity(occurrence: CandidateReadOccurrence | null): JsonValue {
  if (!occurrence) return null;
  return {
    occurrenceId: occurrence.occurrenceId,
    readRelationId: occurrence.readRelationId,
    statementIndex: occurrence.statementIndex,
    relationPath: [...occurrence.relationPath],
  };
}

function evidenceRefsOf(value: unknown): readonly CandidateEvidenceRef[] {
  return records(value)
    .map((item) => {
      const source = text(item.source);
      const locator = text(item.locator);
      if (source === null && locator === null) return null;
      const evidenceRefId = `candidate-evidence:${sha256(
        canonicalJson({ source, locator } as JsonValue),
      )}`;
      return { evidenceRefId, source, locator } satisfies CandidateEvidenceRef;
    })
    .filter((item): item is CandidateEvidenceRef => item !== null)
    .sort((a, b) => a.evidenceRefId.localeCompare(b.evidenceRefId));
}

function writeEvidenceRefs(value: unknown): readonly CandidateEvidenceRef[] {
  return records(value).flatMap((write) => evidenceRefsOf(write.evidence));
}

function gapId(
  rootTaskId: string,
  kind: string,
  identity: JsonValue,
): string {
  return `candidate-gap:${rootTaskId}:${kind}:${sha256(canonicalJson(identity))}`;
}

function branchId(
  rootTaskId: string,
  branchKind: CandidateBranchKind,
  identity: JsonValue,
): string {
  return `candidate-branch:${branchKind.toLowerCase()}:${sha256(
    canonicalJson({ rootTaskId, branchKind, identity } as unknown as JsonValue),
  )}`;
}

function branchIdentity(input: {
  readonly branchKind: CandidateBranchKind;
  readonly consumerTaskId: string | null;
  readonly producerTaskId: string | null;
  readonly table: CandidatePhysicalTable | null;
  readonly readOccurrence: CandidateReadOccurrence | null;
  readonly writeObservationId: string | null;
  readonly boundaryReason: string | null;
}): JsonValue {
  return {
    branchKind: input.branchKind,
    consumerTaskId: input.consumerTaskId,
    producerTaskId: input.producerTaskId,
    table: stableTableIdentity(input.table),
    readOccurrence: occurrenceIdentity(input.readOccurrence),
    writeObservationId: input.writeObservationId,
    boundaryReason: input.boundaryReason,
  };
}

function makeBranch(input: {
  readonly rootTaskId: string;
  readonly branchKind: CandidateBranchKind;
  readonly consumerTaskId?: string | null;
  readonly producerTaskId?: string | null;
  readonly table?: CandidatePhysicalTable | null;
  readonly readOccurrence?: CandidateReadOccurrence | null;
  readonly writeObservationId?: string | null;
  readonly producerRole?: string | null;
  readonly evidenceRefs?: readonly CandidateEvidenceRef[];
  readonly gapRefs?: readonly string[];
  readonly boundaryReason?: string | null;
}): CandidateBranch {
  const consumerTaskId = input.consumerTaskId ?? null;
  const producerTaskId = input.producerTaskId ?? null;
  const table = input.table ?? null;
  const readOccurrence = input.readOccurrence ?? null;
  const writeObservationId = input.writeObservationId ?? null;
  const boundaryReason = input.boundaryReason ?? null;
  const identity = branchIdentity({
    branchKind: input.branchKind,
    consumerTaskId,
    producerTaskId,
    table,
    readOccurrence,
    writeObservationId,
    boundaryReason,
  });
  return {
    candidateBranchId: branchId(input.rootTaskId, input.branchKind, identity),
    branchKind: input.branchKind,
    rootTaskId: input.rootTaskId,
    consumerTaskId,
    producerTaskId,
    table,
    readOccurrence,
    writeObservationId,
    producerRole: input.producerRole ?? null,
    evidenceRefs: [...(input.evidenceRefs ?? [])].sort((a, b) =>
      a.evidenceRefId.localeCompare(b.evidenceRefId),
    ),
    gapRefs: sortedUnique(input.gapRefs ?? []),
    boundaryReason,
  };
}

function readKey(
  consumerTaskId: string | null,
  table: CandidatePhysicalTable | null,
  occurrence: CandidateReadOccurrence | null,
): string {
  return canonicalJson({
    consumerTaskId,
    table: tableIdentity(table),
    occurrence: occurrenceIdentity(occurrence),
  } as JsonValue);
}

function bridgeMatchesRead(
  bridge: JsonRecord,
  read: JsonRecord,
  readTable: CandidatePhysicalTable | null,
): boolean {
  if (text(bridge.consumerTaskId) !== text(read.consumerTaskId)) return false;
  if (tableKey(tableOf(bridge.table)) !== tableKey(readTable)) return false;
  const bridgeOccurrence = occurrenceOf(bridge.readOccurrence);
  const readOccurrence = occurrenceOf(read.readOccurrence);
  if (bridgeOccurrence === null || readOccurrence === null) return false;
  return canonicalJson(occurrenceIdentity(bridgeOccurrence)) ===
    canonicalJson(occurrenceIdentity(readOccurrence));
}

function readIsBlocked(read: JsonRecord): boolean {
  const status = text(read.recursionStatus);
  return (
    status === "BLOCKED" ||
    (Array.isArray(read.blockedStatementIndexes) &&
      read.blockedStatementIndexes.length > 0) ||
    (Array.isArray(read.blockReasons) && read.blockReasons.length > 0) ||
    tableOf(read.table)?.identityStatus === "UNRESOLVED"
  );
}

function boundaryTerminalReason(value: unknown): string | null {
  const reason = text(value);
  if (reason === null) return null;
  if (
    reason.startsWith("MAX_") ||
    reason === "NO_CONFIRMED_PRODUCER_OBSERVED" ||
    reason === "MULTIPLE_OVERLAPPING_PRODUCERS" ||
    reason === "TASK_INPUT_PACK_UNAVAILABLE" ||
    reason === "TASK_INPUT_PACK_INVALID" ||
    reason === "TABLE_PACK_UNAVAILABLE" ||
    reason === "TABLE_PACK_INVALID" ||
    reason === "READ_IDENTITY_UNRESOLVED"
  )
    return reason;
  return null;
}

function sourceArtifactType(artifact: JsonRecord): string {
  return text(artifact.artifactType) ?? "TABLE_MULTI_HOP_RECONCILIATION";
}

export function projectCandidateUniverse(
  input: CandidateUniverseProjectionInput,
): CandidateUniverse {
  const artifact = record(input.tableArtifact);
  if (!artifact) throw new Error("TABLE_MULTI_HOP_ARTIFACT_INVALID");
  const rootTaskId = text(artifact.rootTaskId);
  if (rootTaskId === null) throw new Error("TABLE_MULTI_HOP_ROOT_TASK_MISSING");

  const branches = new Map<string, CandidateBranch>();
  const add = (candidate: CandidateBranch): void => {
    const current = branches.get(candidate.candidateBranchId);
    if (!current) {
      branches.set(candidate.candidateBranchId, candidate);
      return;
    }
    branches.set(candidate.candidateBranchId, {
      ...current,
      producerRole: current.producerRole ?? candidate.producerRole,
      evidenceRefs: [...current.evidenceRefs, ...candidate.evidenceRefs].filter(
        (item, index, all) =>
          all.findIndex((other) => other.evidenceRefId === item.evidenceRefId) === index,
      ),
      gapRefs: sortedUnique([...current.gapRefs, ...candidate.gapRefs]),
    });
  };

  const writeEdges = records(artifact.writeEdges);
  const rootWrites = writeEdges.filter(
    (edge) => text(edge.producerTaskId) === rootTaskId,
  );
  const selectedWriteObservationIds = sortedUnique(input.rootWriteObservationIds ?? []);
  if (rootWrites.length === 0) {
    for (const writeObservationId of selectedWriteObservationIds.length > 0
      ? selectedWriteObservationIds
      : [null])
      add(makeBranch({
        rootTaskId,
        branchKind: "ROOT_WRITE",
        producerTaskId: rootTaskId,
        writeObservationId,
      }));
  } else {
    for (const write of rootWrites)
      for (const writeObservationId of selectedWriteObservationIds.length > 0
        ? selectedWriteObservationIds
        : [null])
        add(makeBranch({
          rootTaskId,
          branchKind: "ROOT_WRITE",
          producerTaskId: rootTaskId,
          table: tableOf(write.table),
          evidenceRefs: writeEvidenceRefs(write.writes),
          writeObservationId,
        }));
  }

  const producerBridges = records(artifact.producerBridges);
  for (const bridge of producerBridges) {
    const consumerTaskId = text(bridge.consumerTaskId);
    const producerTaskId = text(bridge.producerTaskId);
    if (consumerTaskId === null || producerTaskId === null) continue;
    add(
      makeBranch({
        rootTaskId,
        branchKind: "PHYSICAL_PRODUCER",
        consumerTaskId,
        producerTaskId,
        table: tableOf(bridge.table),
        readOccurrence: occurrenceOf(bridge.readOccurrence),
        producerRole: text(bridge.producerRole),
      }),
    );
  }

  const scheduleEdges = records(artifact.scheduleEdges);
  for (const edge of scheduleEdges) {
    const consumerTaskId = text(edge.consumerTaskId);
    const producerTaskId = text(edge.producerTaskId);
    if (consumerTaskId === null || producerTaskId === null) continue;
    add(
      makeBranch({
        rootTaskId,
        branchKind: "SCHEDULE_ONLY",
        consumerTaskId,
        producerTaskId,
        evidenceRefs: evidenceRefsOf(edge.evidence),
      }),
    );
  }

  const readEdges = records(artifact.readEdges);
  const blockedReadGapRefs: string[] = [];
  const unboundReadGapRefs: string[] = [];
  for (const read of readEdges) {
    const consumerTaskId = text(read.consumerTaskId);
    if (consumerTaskId === null) continue;
    const table = tableOf(read.table);
    const occurrence = occurrenceOf(read.readOccurrence);
    const matchingBridge = producerBridges.some((bridge) =>
      bridgeMatchesRead(bridge, read, table),
    );
    if (matchingBridge) continue;
    const blocked = readIsBlocked(read);
    const kind: CandidateBranchKind = blocked ? "BLOCKED_READ" : "UNBOUND_READ";
    const gap = gapId(
      rootTaskId,
      kind,
      {
        consumerTaskId,
        table: tableIdentity(table),
        occurrence: occurrenceIdentity(occurrence),
        blockReasons: records(read.blockReasons),
      } as unknown as JsonValue,
    );
    if (blocked) blockedReadGapRefs.push(gap);
    else unboundReadGapRefs.push(gap);
    add(
      makeBranch({
        rootTaskId,
        branchKind: kind,
        consumerTaskId,
        table,
        readOccurrence: occurrence,
        evidenceRefs: evidenceRefsOf(read.evidence),
        gapRefs: [gap],
        boundaryReason: blocked ? "READ_EVIDENCE_BLOCKED" : "PRODUCER_NOT_OBSERVED",
      }),
    );
  }

  const boundaryGapRefs: string[] = [
    ...blockedReadGapRefs,
    ...unboundReadGapRefs,
  ];
  const coverage = record(artifact.coverage);
  const limits = record(artifact.limits);
  const sourceCoverageStatus = text(coverage?.status);
  const sourceLimitsTruncated = bool(limits?.truncated);
  if (sourceCoverageStatus !== "COMPLETE_OBSERVED_EVIDENCE")
    boundaryGapRefs.push(
      gapId(rootTaskId, "COVERAGE_STATUS", sourceCoverageStatus ?? "MISSING"),
    );
  if (sourceLimitsTruncated)
    boundaryGapRefs.push(
      gapId(rootTaskId, "LIMIT_TRUNCATED", text(limits?.truncationReason) ?? "UNKNOWN"),
    );

  for (const terminal of records(artifact.terminals)) {
    const reason = boundaryTerminalReason(terminal.reason);
    if (reason === null) continue;
    const terminalGap = gapId(
      rootTaskId,
      "TERMINAL",
      {
        taskId: text(terminal.taskId),
        depth: integer(terminal.depth),
        reason,
        table: tableIdentity(tableOf(terminal.table)),
      } as unknown as JsonValue,
    );
    boundaryGapRefs.push(terminalGap);
    add(
      makeBranch({
        rootTaskId,
        branchKind: "COVERAGE_BOUNDARY",
        consumerTaskId: text(terminal.taskId),
        table: tableOf(terminal.table),
        gapRefs: [terminalGap],
        boundaryReason: reason,
      }),
    );
  }

  const uniqueBoundaryGapRefs = sortedUnique(boundaryGapRefs);
  if (uniqueBoundaryGapRefs.length > 0)
    add(
      makeBranch({
        rootTaskId,
        branchKind: "COVERAGE_BOUNDARY",
        gapRefs: uniqueBoundaryGapRefs,
        boundaryReason: "CANDIDATE_UNIVERSE_BOUNDARY",
      }),
    );

  const orderedBranches = [...branches.values()].sort((left, right) =>
    left.candidateBranchId.localeCompare(right.candidateBranchId),
  );
  return {
    rootTaskId,
    status: uniqueBoundaryGapRefs.length === 0 ? "COMPLETE_OBSERVED_EVIDENCE" : "INCOMPLETE",
    branches: orderedBranches,
    boundaryGapRefs: uniqueBoundaryGapRefs,
    coverage: {
      sourceArtifactType: sourceArtifactType(artifact),
      sourceCoverageStatus,
      sourceCoverageSemantics: text(coverage?.semantics),
      sourceLimitsTruncated,
    },
  };
}

export function buildAssessmentPairSkeleton(
  rootTargetFields: readonly string[],
  candidateBranches: readonly CandidateBranch[],
): readonly CandidateAssessmentPair[] {
  const pairs = rootTargetFields.flatMap((rootTargetFieldId) =>
    candidateBranches.map((branch) => ({
      pairId: `assessment-pair:${sha256(
        canonicalJson({
          rootTargetFieldId,
          candidateBranchId: branch.candidateBranchId,
        } as unknown as JsonValue),
      )}`,
      rootTargetFieldId,
      candidateBranchId: branch.candidateBranchId,
      assessment: null,
    } satisfies CandidateAssessmentPair)),
  );
  return [...pairs].sort((left, right) => left.pairId.localeCompare(right.pairId));
}

export function buildCandidateAssessmentPairSkeleton(
  input: CandidateUniverseProjectionInput,
): { readonly universe: CandidateUniverse; readonly pairs: readonly CandidateAssessmentPair[] } {
  const universe = projectCandidateUniverse(input);
  return {
    universe,
    pairs: buildAssessmentPairSkeleton(input.rootTargetFields, universe.branches),
  };
}

export function validateAssessmentPairSkeleton(
  rootTargetFields: readonly string[],
  candidateBranches: readonly CandidateBranch[],
  pairs: readonly CandidateAssessmentPair[],
): CandidateAssessmentPairValidation {
  const errors: string[] = [];
  const expected = new Set(
    buildAssessmentPairSkeleton(rootTargetFields, candidateBranches).map(
      (pair) => pair.pairId,
    ),
  );
  const seen = new Set<string>();
  for (const pair of pairs) {
    if (seen.has(pair.pairId)) errors.push(`DUPLICATE:${pair.pairId}`);
    seen.add(pair.pairId);
    if (!expected.has(pair.pairId)) errors.push(`UNEXPECTED:${pair.pairId}`);
    if (pair.assessment !== null) errors.push(`DECISION_PRESENT:${pair.pairId}`);
  }
  for (const pairId of expected)
    if (!seen.has(pairId)) errors.push(`MISSING:${pairId}`);
  return { valid: errors.length === 0, errors: errors.sort((a, b) => a.localeCompare(b)) };
}

export function assertAssessmentPairSkeleton(
  rootTargetFields: readonly string[],
  candidateBranches: readonly CandidateBranch[],
  pairs: readonly CandidateAssessmentPair[],
): void {
  const result = validateAssessmentPairSkeleton(
    rootTargetFields,
    candidateBranches,
    pairs,
  );
  if (!result.valid) throw new Error(`ASSESSMENT_PAIR_SKELETON_INVALID:${result.errors.join(",")}`);
}

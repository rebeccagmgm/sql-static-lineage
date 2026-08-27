import type {
  CalciteCanonicalSourceEvidence,
  CalciteOracleFingerprint,
  CalciteSemanticObservation,
  NativeSemanticObservation,
  DifferentialReason,
} from "../../../calcite-oracle/protocol.ts";
import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import type {
  CalciteSemanticBatchResult,
  CalciteSemanticDifferentialResult,
  CalciteSemanticDifferentialStatus,
  CalciteSemanticMappingReport,
} from "./calcite-semantic-mapping.ts";

/** The artifact is deliberately separate from TARGET_FIELD_CAUSAL_SLICE. */
export const CALCITE_SEMANTIC_SHADOW_REPORT_TYPE =
  "CALCITE_SEMANTIC_SHADOW_REPORT" as const;
export const CALCITE_SEMANTIC_SHADOW_REPORT_SCHEMA_VERSION = 1 as const;
export const CALCITE_SEMANTIC_SHADOW_REPORT_VERSION = "1.0.0" as const;

export type CalciteShadowObservationStatus =
  | "AGREED"
  | "NATIVE_ONLY"
  | "CALCITE_ONLY_UNMAPPABLE"
  | "NOT_EVALUATED"
  | "CONFLICT";

export type CalciteShadowMappingStatus =
  | "MAPPED"
  | "UNMAPPABLE"
  | "NOT_EVALUATED";

export type CalciteShadowGateStatus = "GO" | "NO_GO" | "NOT_EVALUATED";

export interface CalciteShadowFingerprints {
  /** Fingerprint of the immutable input snapshot used by the shadow run. */
  readonly input: string;
  /** Fingerprint of the Native observation snapshot. */
  readonly native: string;
  /** The Calcite oracle fingerprint, when a sidecar response supplied one. */
  readonly calcite: CalciteOracleFingerprint | null;
}

export interface CalciteShadowObservation {
  readonly observationKey: string;
  readonly batch: CalciteSemanticDifferentialResult["batch"];
  readonly status: CalciteShadowObservationStatus;
  /** The pre-existing reconciler status is retained for auditability. */
  readonly differentialStatus: CalciteSemanticDifferentialStatus;
  readonly nativeObservationIds: readonly string[];
  readonly calciteObservationIds: readonly string[];
  readonly nativeObservations: readonly NativeSemanticObservation[];
  readonly calciteObservations: readonly CalciteSemanticObservation[];
  readonly nativeValues: readonly unknown[];
  readonly calciteValues: readonly unknown[];
  readonly mappingStatus: {
    readonly occurrence: CalciteShadowMappingStatus;
    readonly field: CalciteShadowMappingStatus;
    readonly operator: CalciteShadowMappingStatus;
    readonly sourceEvidence: CalciteShadowMappingStatus;
  };
  readonly reason?: DifferentialReason;
  readonly conflict?: {
    readonly nativeOnly: readonly unknown[];
    readonly calciteOnly: readonly unknown[];
  };
}

export interface CalciteShadowBatchSummary {
  readonly batch: CalciteSemanticBatchResult["batch"];
  readonly status: CalciteShadowObservationStatus;
  readonly observationCount: number;
  readonly reason?: DifferentialReason;
}

export interface CalciteShadowReleaseGate {
  readonly status: CalciteShadowGateStatus;
  readonly checkedObservations: number;
  readonly failedObservations: number;
  readonly reasonCodes: readonly string[];
}

export interface CalciteShadowReleaseGates {
  readonly occurrenceMapping: CalciteShadowReleaseGate;
  readonly fieldMapping: CalciteShadowReleaseGate;
  readonly operatorMapping: CalciteShadowReleaseGate;
  readonly sourceEvidenceMapping: CalciteShadowReleaseGate;
  readonly supportedCorpusAgreement: CalciteShadowReleaseGate;
  readonly overall: CalciteShadowGateStatus;
}

export interface CalciteShadowArtifactValidationInput {
  readonly status: "VALID" | "UNKNOWN";
  readonly artifactType?: string;
  readonly reasonCodes?: readonly string[];
  readonly errors?: readonly string[];
}

export interface CalciteShadowValidationSummary {
  /** This summary is an advisory and cannot affect canonical artifact state. */
  readonly advisoryOnly: true;
  readonly status: "VALID" | "UNKNOWN";
  readonly artifactType?: string;
  readonly reasonCodes: readonly string[];
  readonly errors: readonly string[];
}

export interface CalciteSemanticShadowReportInput {
  /** Preferred name. `mapping` and `differential` are compatibility aliases. */
  readonly mappingReport?: CalciteSemanticMappingReport;
  readonly mapping?: CalciteSemanticMappingReport;
  readonly differential?: CalciteSemanticMappingReport;
  readonly inputFingerprint?: string;
  readonly nativeFingerprint?: string;
  readonly calciteFingerprint?: CalciteOracleFingerprint;
  readonly fingerprints?: Partial<CalciteShadowFingerprints>;
  readonly artifactValidationSummary?: CalciteShadowArtifactValidationInput;
  /** Accepted only to make the non-mutation boundary explicit; never retained. */
  readonly canonicalArtifact?: unknown;
}

export interface CalciteSemanticShadowReport {
  readonly artifactType: typeof CALCITE_SEMANTIC_SHADOW_REPORT_TYPE;
  readonly schemaVersion: typeof CALCITE_SEMANTIC_SHADOW_REPORT_SCHEMA_VERSION;
  readonly reportVersion: typeof CALCITE_SEMANTIC_SHADOW_REPORT_VERSION;
  readonly fingerprints: CalciteShadowFingerprints;
  readonly inputFingerprint: string;
  readonly nativeFingerprint: string;
  readonly calciteFingerprint: CalciteOracleFingerprint | null;
  readonly batches: readonly CalciteShadowBatchSummary[];
  readonly observations: readonly CalciteShadowObservation[];
  readonly counts: {
    readonly observations: number;
    readonly byStatus: Readonly<Record<CalciteShadowObservationStatus, number>>;
    readonly mapping: Readonly<
      Record<
        "occurrence" | "field" | "operator" | "sourceEvidence",
        Readonly<Record<CalciteShadowMappingStatus, number>>
      >
    >;
  };
  readonly releaseGates: CalciteShadowReleaseGates;
  readonly validationSummary?: CalciteShadowValidationSummary;
  /** No canonical dependency, proof, assessment, or rerun data is present. */
  readonly decisionIsolation: {
    readonly canonicalDependencies: "NOT_INCLUDED";
    readonly assessments: "NOT_INCLUDED";
    readonly negativeProofs: "NOT_INCLUDED";
    readonly rerunSets: "NOT_INCLUDED";
    readonly canonicalArtifactsMutated: false;
  };
  readonly contentHash: string;
}

type ReportWithoutHash = Omit<CalciteSemanticShadowReport, "contentHash">;

const BATCH_ORDER: readonly string[] = [
  "EXPRESSION_CONTROLS",
  "FILTERS_AND_JOINS",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "WINDOW_TOP_N",
  "RELATION_CONTEXT",
];

const SHADOW_STATUSES: readonly CalciteShadowObservationStatus[] = [
  "AGREED",
  "NATIVE_ONLY",
  "CALCITE_ONLY_UNMAPPABLE",
  "NOT_EVALUATED",
  "CONFLICT",
];

const MAPPING_AXES = [
  "occurrence",
  "field",
  "operator",
  "sourceEvidence",
] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalKey(value: unknown): string {
  return canonicalJson(value).trim();
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function sortedUnknown(values: readonly unknown[]): readonly unknown[] {
  return [...values].sort((left, right) => compareText(canonicalKey(left), canonicalKey(right)));
}

function sortedObservationIds(values: readonly string[]): readonly string[] {
  return sortedStrings(values);
}

function stableObservation<T extends NativeSemanticObservation | CalciteSemanticObservation>(
  observation: T,
): T {
  return {
    ...observation,
    ...(observation.values !== undefined
      ? { values: sortedUnknown(observation.values) }
      : {}),
  } as T;
}

function stableObservations<T extends NativeSemanticObservation | CalciteSemanticObservation>(
  observations: readonly T[],
): readonly T[] {
  return [...observations]
    .map(stableObservation)
    .sort((left, right) =>
      compareText(
        `${left.observationId}\u0000${canonicalKey(left)}`,
        `${right.observationId}\u0000${canonicalKey(right)}`,
      ),
    );
}

function normalizeStatus(
  status: CalciteSemanticDifferentialStatus,
): CalciteShadowObservationStatus {
  switch (status) {
    case "CALCITE_CORROBORATED":
      return "AGREED";
    case "NATIVE_CONFIRMED":
      return "NATIVE_ONLY";
    case "CALCITE_ONLY_UNMAPPABLE":
      return "CALCITE_ONLY_UNMAPPABLE";
    case "NOT_EVALUATED":
      return "NOT_EVALUATED";
    case "SEMANTIC_ENGINE_CONFLICT":
      return "CONFLICT";
  }
}

function axisStatuses(
  result: CalciteSemanticDifferentialResult,
): CalciteShadowObservation["mappingStatus"] {
  const status = normalizeStatus(result.status);
  if (status === "AGREED" || status === "CONFLICT")
    return {
      occurrence: "MAPPED",
      field: "MAPPED",
      operator: "MAPPED",
      sourceEvidence: "MAPPED",
    };
  if (status === "NATIVE_ONLY" || status === "NOT_EVALUATED")
    return {
      occurrence: "NOT_EVALUATED",
      field: "NOT_EVALUATED",
      operator: "NOT_EVALUATED",
      sourceEvidence: "NOT_EVALUATED",
    };

  const code = result.reason?.code ?? "NO_EXACT_NATIVE_OBSERVATION";
  if (code === "RELATION_OCCURRENCE_NOT_MAPPED" ||
      code === "AMBIGUOUS_RELATION_OCCURRENCE_MAPPING" ||
      code === "RELATION_SOURCE_EVIDENCE_MISSING" ||
      code === "RELATION_SOURCE_EVIDENCE_MISMATCH")
    return {
      occurrence: "UNMAPPABLE",
      field: "NOT_EVALUATED",
      operator: "NOT_EVALUATED",
      sourceEvidence: "UNMAPPABLE",
    };
  if (code === "FIELD_OR_OUTPUT_ORDINAL_MISSING")
    return {
      occurrence: "MAPPED",
      field: "UNMAPPABLE",
      operator: "NOT_EVALUATED",
      sourceEvidence: "NOT_EVALUATED",
    };
  if (code === "OPERATOR_IDENTITY_MISSING" ||
      code === "UNSUPPORTED_OPERATOR_FOR_BATCH" ||
      code === "UNSUPPORTED_NATIVE_OPERATOR_FOR_BATCH")
    return {
      occurrence: "MAPPED",
      field: "MAPPED",
      operator: "UNMAPPABLE",
      sourceEvidence: "NOT_EVALUATED",
    };
  if (code === "CANONICAL_SOURCE_EVIDENCE_MISSING")
    return {
      occurrence: "MAPPED",
      field: "MAPPED",
      operator: "MAPPED",
      sourceEvidence: "UNMAPPABLE",
    };
  // A generic lack of exact Native identity is conservatively unmappable on
  // every required axis. It cannot be promoted to an agreement or proof.
  return {
    occurrence: "UNMAPPABLE",
    field: "UNMAPPABLE",
    operator: "UNMAPPABLE",
    sourceEvidence: "UNMAPPABLE",
  };
}

function observationKey(result: CalciteSemanticDifferentialResult): string {
  return result.identityKey ?? canonicalKey({
    batch: result.batch,
    nativeObservationIds: sortedObservationIds(result.nativeObservationIds),
    calciteObservationIds: sortedObservationIds(result.calciteObservationIds),
    reason: result.reason ?? null,
  });
}

function stableReason(reason: DifferentialReason | undefined): DifferentialReason | undefined {
  return reason === undefined ? undefined : { code: reason.code, message: reason.message };
}

function projectObservation(
  result: CalciteSemanticDifferentialResult,
): CalciteShadowObservation {
  const nativeValues = sortedUnknown(result.nativeValues);
  const calciteValues = sortedUnknown(result.calciteValues);
  const conflict = result.conflict === undefined
    ? undefined
    : {
        nativeOnly: sortedUnknown(result.conflict.nativeOnly),
        calciteOnly: sortedUnknown(result.conflict.calciteOnly),
      };
  return {
    observationKey: observationKey(result),
    batch: result.batch,
    status: normalizeStatus(result.status),
    differentialStatus: result.status,
    nativeObservationIds: sortedObservationIds(result.nativeObservationIds),
    calciteObservationIds: sortedObservationIds(result.calciteObservationIds),
    nativeObservations: stableObservations(result.nativeObservations),
    calciteObservations: stableObservations(result.calciteObservations),
    nativeValues,
    calciteValues,
    mappingStatus: axisStatuses(result),
    ...(result.reason ? { reason: stableReason(result.reason) } : {}),
    ...(conflict ? { conflict } : {}),
  };
}

function batchStatus(batch: CalciteSemanticBatchResult): CalciteShadowObservationStatus {
  if (batch.status === "SEMANTIC_ENGINE_CONFLICT") return "CONFLICT";
  if (batch.status === "CALCITE_CORROBORATED") return "AGREED";
  if (batch.status === "NATIVE_CONFIRMED") return "NATIVE_ONLY";
  if (batch.status === "CALCITE_ONLY_UNMAPPABLE") return "CALCITE_ONLY_UNMAPPABLE";
  return "NOT_EVALUATED";
}

function gate(
  statuses: readonly CalciteShadowMappingStatus[],
  reasons: readonly string[],
): CalciteShadowReleaseGate {
  const failedObservations = statuses.filter((status) => status === "UNMAPPABLE").length;
  const checkedObservations = statuses.filter((status) => status !== "NOT_EVALUATED").length;
  const status: CalciteShadowGateStatus = failedObservations > 0
    ? "NO_GO"
    : checkedObservations === 0 || statuses.some((item) => item === "NOT_EVALUATED")
      ? "NOT_EVALUATED"
      : "GO";
  return {
    status,
    checkedObservations,
    failedObservations,
    reasonCodes: sortedStrings(reasons),
  };
}

function reasonCodesFor(
  observations: readonly CalciteShadowObservation[],
  predicate: (observation: CalciteShadowObservation) => boolean,
): readonly string[] {
  return sortedStrings(
    observations
      .filter(predicate)
      .flatMap((observation) => observation.reason?.code ?? []),
  );
}

function calculateGates(
  observations: readonly CalciteShadowObservation[],
  batches: readonly CalciteShadowBatchSummary[],
): CalciteShadowReleaseGates {
  const occurrenceMapping = gate(
    observations.map((observation) => observation.mappingStatus.occurrence),
    reasonCodesFor(observations, (observation) => observation.mappingStatus.occurrence !== "MAPPED"),
  );
  const fieldMapping = gate(
    observations.map((observation) => observation.mappingStatus.field),
    reasonCodesFor(observations, (observation) => observation.mappingStatus.field !== "MAPPED"),
  );
  const operatorMapping = gate(
    observations.map((observation) => observation.mappingStatus.operator),
    reasonCodesFor(observations, (observation) => observation.mappingStatus.operator !== "MAPPED"),
  );
  const sourceEvidenceMapping = gate(
    observations.map((observation) => observation.mappingStatus.sourceEvidence),
    reasonCodesFor(observations, (observation) => observation.mappingStatus.sourceEvidence !== "MAPPED"),
  );

  const agreementReasons = observations
    .filter((observation) => observation.status !== "AGREED")
    .flatMap((observation) => observation.reason?.code ?? []);
  const hasConflict = observations.some((observation) => observation.status === "CONFLICT");
  const hasUnmappable = observations.some(
    (observation) => observation.status === "CALCITE_ONLY_UNMAPPABLE",
  );
  const hasNotEvaluated = observations.some(
    (observation) => observation.status === "NOT_EVALUATED" || observation.status === "NATIVE_ONLY",
  ) || batches.some((batch) => batch.status === "NOT_EVALUATED");
  const supportedCorpusAgreement: CalciteShadowReleaseGate = {
    status: hasConflict || hasUnmappable
      ? "NO_GO"
      : observations.length === 0 || hasNotEvaluated
        ? "NOT_EVALUATED"
        : "GO",
    checkedObservations: observations.filter((observation) => observation.status === "AGREED").length,
    failedObservations: observations.filter(
      (observation) => observation.status === "CONFLICT" || observation.status === "CALCITE_ONLY_UNMAPPABLE",
    ).length,
    reasonCodes: sortedStrings([
      ...agreementReasons,
      ...(hasConflict ? ["SEMANTIC_ENGINE_CONFLICT"] : []),
    ]),
  };
  const all = [
    occurrenceMapping,
    fieldMapping,
    operatorMapping,
    sourceEvidenceMapping,
    supportedCorpusAgreement,
  ];
  const overall: CalciteShadowGateStatus = all.some((item) => item.status === "NO_GO")
    ? "NO_GO"
    : all.some((item) => item.status === "NOT_EVALUATED")
      ? "NOT_EVALUATED"
      : "GO";
  return {
    occurrenceMapping,
    fieldMapping,
    operatorMapping,
    sourceEvidenceMapping,
    supportedCorpusAgreement,
    overall,
  };
}

function makeValidationSummary(
  input: CalciteShadowArtifactValidationInput | undefined,
  observations: readonly CalciteShadowObservation[],
): CalciteShadowValidationSummary | undefined {
  if (input === undefined) return undefined;
  const conflict = observations.some((observation) => observation.status === "CONFLICT");
  return {
    advisoryOnly: true,
    status: conflict ? "UNKNOWN" : input.status,
    ...(input.artifactType ? { artifactType: input.artifactType } : {}),
    reasonCodes: sortedStrings([
      ...(input.reasonCodes ?? []),
      ...(conflict ? ["SEMANTIC_ENGINE_CONFLICT"] : []),
    ]),
    errors: sortedStrings(input.errors ?? []),
  };
}

function fallbackNativeFingerprint(mapping: CalciteSemanticMappingReport): string {
  return sha256(canonicalJson(mapping.batches.map((batch) => ({
    batch: batch.batch,
    observations: batch.results.flatMap((result) => result.nativeObservations),
  }))));
}

function fallbackInputFingerprint(mapping: CalciteSemanticMappingReport): string {
  return sha256(canonicalJson(mapping.batches.map((batch) => ({
    batch: batch.batch,
    results: batch.results.map((result) => ({
      native: result.nativeObservations,
      calcite: result.calciteObservations,
    })),
  }))));
}

function mappingFrom(input: CalciteSemanticShadowReportInput): CalciteSemanticMappingReport {
  const mapping = input.mappingReport ?? input.mapping ?? input.differential;
  if (mapping === undefined)
    throw new Error("CALCITE_SHADOW_MAPPING_REPORT_REQUIRED");
  return mapping;
}

function withoutHash(report: CalciteSemanticShadowReport): ReportWithoutHash {
  const { contentHash: _contentHash, ...stable } = report;
  return stable;
}

export function hashCalciteSemanticShadowReport(
  report: ReportWithoutHash | CalciteSemanticShadowReport,
): string {
  const stable = "contentHash" in report ? withoutHash(report) : report;
  return sha256(canonicalJson(stable));
}

/** Return the report with every set-like collection canonically ordered. */
export function canonicalizeCalciteSemanticShadowReport(
  report: ReportWithoutHash | CalciteSemanticShadowReport,
): CalciteSemanticShadowReport {
  const source = "contentHash" in report ? withoutHash(report) : report;
  const observations = [...source.observations].sort((left, right) =>
    compareText(left.observationKey, right.observationKey),
  );
  const batches = [...source.batches].sort((left, right) =>
    BATCH_ORDER.indexOf(left.batch) - BATCH_ORDER.indexOf(right.batch) ||
      compareText(left.batch, right.batch),
  );
  const canonicalReport: ReportWithoutHash = {
    ...source,
    batches,
    observations,
    counts: {
      ...source.counts,
      byStatus: Object.fromEntries(
        SHADOW_STATUSES.map((status) => [status, source.counts.byStatus[status] ?? 0]),
      ) as Readonly<Record<CalciteShadowObservationStatus, number>>,
    },
  };
  return {
    ...canonicalReport,
    contentHash: hashCalciteSemanticShadowReport(canonicalReport),
  };
}

/**
 * Build the non-decisional shadow artifact from the existing differential
 * observations. The input artifact, when supplied, is intentionally ignored
 * after this call: no canonical dependency or decision object is retained.
 */
export function buildCalciteSemanticShadowReport(
  input: CalciteSemanticShadowReportInput,
): CalciteSemanticShadowReport {
  const mapping = mappingFrom(input);
  const observations = mapping.results.map(projectObservation);
  const batches = mapping.batches.map((batch) => ({
    batch: batch.batch,
    status: batchStatus(batch),
    observationCount: batch.results.length,
    ...(batch.reason ? { reason: stableReason(batch.reason) } : {}),
  }));
  const statusCounts = Object.fromEntries(
    SHADOW_STATUSES.map((status) => [
      status,
      observations.filter((observation) => observation.status === status).length,
    ]),
  ) as Record<CalciteShadowObservationStatus, number>;
  const mappingCounts = Object.fromEntries(
    MAPPING_AXES.map((axis) => [
      axis,
      Object.fromEntries(
        (["MAPPED", "UNMAPPABLE", "NOT_EVALUATED"] as const).map((status) => [
          status,
          observations.filter((observation) => observation.mappingStatus[axis] === status).length,
        ]),
      ),
    ]),
  ) as ReportWithoutHash["counts"]["mapping"];
  const nativeFingerprint = input.nativeFingerprint ?? input.fingerprints?.native ?? fallbackNativeFingerprint(mapping);
  const inputFingerprint = input.inputFingerprint ?? input.fingerprints?.input ?? fallbackInputFingerprint(mapping);
  const calciteFingerprint = input.calciteFingerprint ?? input.fingerprints?.calcite ?? mapping.fingerprint ?? null;
  const releaseGates = calculateGates(observations, batches);
  const report: ReportWithoutHash = {
    artifactType: CALCITE_SEMANTIC_SHADOW_REPORT_TYPE,
    schemaVersion: CALCITE_SEMANTIC_SHADOW_REPORT_SCHEMA_VERSION,
    reportVersion: CALCITE_SEMANTIC_SHADOW_REPORT_VERSION,
    fingerprints: {
      input: inputFingerprint,
      native: nativeFingerprint,
      calcite: calciteFingerprint,
    },
    inputFingerprint,
    nativeFingerprint,
    calciteFingerprint,
    batches,
    observations,
    counts: {
      observations: observations.length,
      byStatus: statusCounts,
      mapping: mappingCounts,
    },
    releaseGates,
    ...(makeValidationSummary(input.artifactValidationSummary, observations)
      ? { validationSummary: makeValidationSummary(input.artifactValidationSummary, observations) }
      : {}),
    decisionIsolation: {
      canonicalDependencies: "NOT_INCLUDED",
      assessments: "NOT_INCLUDED",
      negativeProofs: "NOT_INCLUDED",
      rerunSets: "NOT_INCLUDED",
      canonicalArtifactsMutated: false,
    },
  };
  return canonicalizeCalciteSemanticShadowReport(report);
}

/** Alias used by shadow-mode callers that name the operation "validate". */
export const validateCalciteSemanticShadow = buildCalciteSemanticShadowReport;
export const createCalciteSemanticShadowReport = buildCalciteSemanticShadowReport;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ordered(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareText(values[index - 1]!, value) <= 0);
}

function forbiddenKeys(value: unknown, path = "report"): string[] {
  if (path === "report.decisionIsolation") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenKeys(item, `${path}[${index}]`));
  if (!isRecord(value)) return [];
  const forbidden = new Set([
    "dependencies",
    "assessments",
    "decisions",
    "positiveproofs",
    "negativeproofs",
    "rerunsets",
    "proofs",
  ]);
  const errors: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.replace(/[_-]/g, "").toLowerCase()))
      errors.push(`DECISION_DATA_PRESENT:${path}.${key}`);
    errors.push(...forbiddenKeys(child, `${path}.${key}`));
  }
  return errors;
}

/** Validate structure, canonical ordering/hash, gates, and decision isolation. */
export function validateCalciteSemanticShadowReport(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["report must be an object"];
  const report = value as unknown as CalciteSemanticShadowReport;
  if (report.artifactType !== CALCITE_SEMANTIC_SHADOW_REPORT_TYPE)
    errors.push("artifactType is invalid");
  if (report.schemaVersion !== CALCITE_SEMANTIC_SHADOW_REPORT_SCHEMA_VERSION)
    errors.push("schemaVersion is unsupported");
  if (report.reportVersion !== CALCITE_SEMANTIC_SHADOW_REPORT_VERSION)
    errors.push("reportVersion is unsupported");
  if (!report.fingerprints || typeof report.inputFingerprint !== "string" || typeof report.nativeFingerprint !== "string")
    errors.push("input/native fingerprints are required");
  if (!Array.isArray(report.batches) || !Array.isArray(report.observations))
    errors.push("batches and observations are required");
  const observationKeys = report.observations?.map((observation) => observation.observationKey) ?? [];
  if (new Set(observationKeys).size !== observationKeys.length) errors.push("observationKey values must be unique");
  if (!ordered(observationKeys)) errors.push("observations must be sorted by observationKey");
  const batchKeys = report.batches?.map((batch) => batch.batch) ?? [];
  if (!ordered(batchKeys.map((batch) => String(BATCH_ORDER.indexOf(batch)).padStart(2, "0"))))
    errors.push("batches must use canonical order");
  if (report.counts?.observations !== report.observations?.length)
    errors.push("counts.observations does not match");
  for (const status of SHADOW_STATUSES) {
    if (report.counts?.byStatus?.[status] !== report.observations?.filter((item) => item.status === status).length)
      errors.push(`counts.byStatus.${status} does not match`);
  }
  for (const observation of report.observations ?? []) {
    if (observation.status === "CONFLICT" && observation.conflict === undefined)
      errors.push(`conflict details are required:${observation.observationKey}`);
    if (observation.status === "CALCITE_ONLY_UNMAPPABLE" && observation.nativeObservationIds.length > 0)
      errors.push(`unmappable observation has Native ids:${observation.observationKey}`);
  }
  if (report.validationSummary !== undefined && report.validationSummary.advisoryOnly !== true)
    errors.push("validationSummary must be advisoryOnly");
  if (report.observations?.some((observation) => observation.status === "CONFLICT") && report.validationSummary?.status !== "UNKNOWN")
    errors.push("conflict requires an UNKNOWN validation summary when a summary is present");
  if (report.decisionIsolation?.canonicalDependencies !== "NOT_INCLUDED" ||
      report.decisionIsolation?.assessments !== "NOT_INCLUDED" ||
      report.decisionIsolation?.negativeProofs !== "NOT_INCLUDED" ||
      report.decisionIsolation?.rerunSets !== "NOT_INCLUDED" ||
      report.decisionIsolation?.canonicalArtifactsMutated !== false)
    errors.push("decision isolation contract is invalid");
  errors.push(...forbiddenKeys(report));
  if (typeof report.contentHash !== "string" || report.contentHash.length !== 64)
    errors.push("contentHash is required");
  else if (hashCalciteSemanticShadowReport(report) !== report.contentHash)
    errors.push("contentHash does not match canonical report");
  return [...new Set(errors)];
}

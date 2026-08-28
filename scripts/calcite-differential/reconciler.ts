import {
  DIFFERENTIAL_METADATA_KINDS,
  stableSerialize,
} from "./protocol.ts";
import type {
  DifferentialEvaluation,
  DifferentialInput,
  DifferentialIssue,
  DifferentialMetadataKind,
  DifferentialObservationSet,
  DifferentialReason,
  DifferentialReconciliation,
  DifferentialResponse,
  DifferentialResult,
} from "./protocol.ts";
import type {
  CalciteOracleFingerprint as LegacyFingerprint,
  CalciteOracleMetadataKind as LegacyMetadataKind,
  CalciteOracleObservations as LegacyObservations,
  CalciteOracleResponse as LegacyResponse,
  DifferentialInput as LegacyInput,
  DifferentialObservation as LegacyObservation,
  DifferentialObservationSet as LegacyObservationSet,
  DifferentialReconciliation as LegacyReconciliation,
  DifferentialReason as LegacyReason,
  DifferentialResult as LegacyResult,
} from "../calcite-oracle/protocol.ts";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function valueKey(value: unknown): string {
  return stableSerialize(value);
}

function normalizedValues(values: readonly unknown[]): readonly string[] {
  return values.map(valueKey).sort(compareText);
}

function sameValues(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  const leftKeys = normalizedValues(left);
  const rightKeys = normalizedValues(right);
  return stableSerialize(leftKeys) === stableSerialize(rightKeys);
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function evaluationFor(
  set: DifferentialObservationSet,
  kind: DifferentialMetadataKind,
): DifferentialEvaluation {
  return (
    set[kind] ?? {
      evaluated: false,
      values: [],
    }
  );
}

function exactMapping(
  native: DifferentialEvaluation,
  calcite: DifferentialEvaluation,
): boolean {
  const nativeRefs = native.mappingRefs ?? [];
  const calciteRefs = calcite.mappingRefs ?? [];
  return (
    nativeRefs.length === 1 &&
    calciteRefs.length === 1 &&
    nativeRefs[0] !== "" &&
    calciteRefs[0] !== "" &&
    nativeRefs[0] === calciteRefs[0]
  );
}

function resultFor(
  kind: DifferentialMetadataKind,
  native: DifferentialEvaluation,
  calcite: DifferentialEvaluation,
  forceNotEvaluated = false,
  sidecarReason?: DifferentialReason,
): DifferentialResult {
  const nativeValues = [...native.values];
  const calciteValues = [...calcite.values];
  const mappingRefs = sortedUnique([
    ...(native.mappingRefs ?? []),
    ...(calcite.mappingRefs ?? []),
  ]);
  const evidenceRefs = sortedUnique([
    ...(native.evidenceRefs ?? []),
    ...(calcite.evidenceRefs ?? []),
  ]);
  if (forceNotEvaluated) {
    return {
      kind,
      status: "NOT_EVALUATED",
      nativeValues,
      calciteValues,
      mappingRefs,
      evidenceRefs,
      reason: sidecarReason ?? native.reason ?? calcite.reason,
    };
  }

  if (!native.evaluated && !calcite.evaluated)
    return {
      kind,
      status: "NOT_EVALUATED",
      nativeValues,
      calciteValues,
      mappingRefs,
      evidenceRefs,
      reason:
        sidecarReason ??
        native.reason ??
        calcite.reason ?? {
          code: "OBSERVATION_NOT_PROVIDED",
          message: `No ${kind} observation was evaluated by either side.`,
        },
    };
  if (native.evaluated && !calcite.evaluated)
    return {
      kind,
      status: native.confirmed ? "NATIVE_CONFIRMED" : "NATIVE_ONLY",
      nativeValues,
      calciteValues,
      mappingRefs,
      evidenceRefs,
      reason:
        sidecarReason ??
        calcite.reason ?? {
          code: "NO_EXACT_CALCITE_OBSERVATION",
          message:
            "No Calcite observation matched the requested metadata kind.",
        },
    };
  if (!exactMapping(native, calcite))
    return {
      kind,
      status: "CALCITE_ONLY_UNMAPPABLE",
      nativeValues,
      calciteValues,
      mappingRefs,
      evidenceRefs,
      reason:
        calcite.reason ??
        native.reason ?? {
          code: "EXACT_MAPPING_REQUIRED",
          message:
            "Calcite observation requires the same single non-empty mapping ref as the Native observation.",
        },
    };
  if (sameValues(nativeValues, calciteValues))
    return {
      kind,
      status: "CALCITE_CORROBORATED",
      nativeValues,
      calciteValues,
      mappingRefs,
      evidenceRefs,
    };

  const nativeKeys = new Set(normalizedValues(nativeValues));
  const calciteKeys = new Set(normalizedValues(calciteValues));
  return {
    kind,
    status: "SEMANTIC_ENGINE_CONFLICT",
    nativeValues,
    calciteValues,
    mappingRefs,
    evidenceRefs,
    reason: {
      code: "SEMANTIC_ENGINE_CONFLICT",
      message:
        "Native and Calcite observations share an exact mapping but disagree on their semantic value.",
    },
    conflict: {
      nativeOnly: nativeValues.filter((value) => !calciteKeys.has(valueKey(value))),
      calciteOnly: calciteValues.filter((value) => !nativeKeys.has(valueKey(value))),
    },
  };
}

/**
 * Reconcile already-produced observations without reading SQL or canonical
 * artifacts.  Calcite agreement is usable only when both sides carry the
 * same non-empty mapping refs.
 */
export function reconcileDifferential(
  input: DifferentialInput,
): DifferentialReconciliation {
  return {
    results: DIFFERENTIAL_METADATA_KINDS.map((kind) =>
      resultFor(kind, evaluationFor(input.native, kind), evaluationFor(input.calcite, kind)),
    ),
  };
}

function responseIssues(response: DifferentialResponse): readonly DifferentialIssue[] {
  return response.issues.length > 0
    ? response.issues
    : [
        {
          code:
            response.status === "SUCCESS"
              ? "CALCITE_OBSERVATION_NOT_PROVIDED"
              : "CALCITE_SIDECAR_NOT_EVALUATED",
          message:
            response.status === "SUCCESS"
              ? "Calcite returned no observation for this metadata kind."
              : `Calcite sidecar status is ${response.status}.`,
          severity: "ERROR",
        },
      ];
}

interface ResponseObservationValues {
  readonly values: readonly unknown[];
  readonly mappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
}

function responseObservationSet(
  response: DifferentialResponse,
): DifferentialObservationSet {
  const grouped = new Map<DifferentialMetadataKind, ResponseObservationValues[]>();
  for (const observation of response.observations) {
    if (observation.status === "NOT_EVALUATED") continue;
    const values = observation.values ?? (
      observation.value === undefined ? [] : [observation.value]
    );
    const current = grouped.get(observation.kind) ?? [];
    current.push({
      values,
      mappingRefs: observation.mappingRefs,
      evidenceRefs: observation.evidenceRefs,
    });
    grouped.set(observation.kind, current);
  }
  const result = new Map<DifferentialMetadataKind, DifferentialEvaluation>();
  for (const [kind, observations] of grouped) {
    const mappingRefs = sortedUnique(
      observations.flatMap((observation) => observation.mappingRefs),
    );
    const evidenceRefs = sortedUnique(
      observations.flatMap((observation) => observation.evidenceRefs),
    );
    if (mappingRefs.length > 1 || observations.some((observation) => observation.mappingRefs.length !== 1)) {
      result.set(kind, {
        evaluated: true,
        values: [],
        mappingRefs,
        evidenceRefs,
        reason: {
          code: "MULTIPLE_MAPPING_REFS_UNMAPPABLE",
          message:
            "Multiple Calcite mapping refs were returned for one metadata kind; per-value mapping is unavailable.",
        },
      });
      continue;
    }
    result.set(kind, {
      evaluated: true,
      values: observations.flatMap((observation) => observation.values),
      mappingRefs,
      evidenceRefs,
    });
  }
  return Object.fromEntries(result) as DifferentialObservationSet;
}

/** Reconcile a structured response and preserve sidecar issues separately. */
export function reconcileDifferentialResponse(
  native: DifferentialObservationSet,
  response: DifferentialResponse,
): DifferentialReconciliation {
  const failed = response.status !== "SUCCESS";
  const calcite = failed ? {} : responseObservationSet(response);
  const reason = responseIssues(response).map(({ code, message }) => ({
    code,
    message,
  }))[0];
  return {
    fingerprint: response.fingerprint,
    sidecar: {
      status: response.status,
      issues: response.issues,
    },
    results: DIFFERENTIAL_METADATA_KINDS.map((kind) =>
      resultFor(
        kind,
        evaluationFor(native, kind),
        evaluationFor(calcite, kind),
        failed,
        reason,
      ),
    ),
  };
}

export const reconcileResponse = reconcileDifferentialResponse;
export const reconcileCalciteResponse = reconcileDifferentialResponse;

/*
 * Legacy adapter implementation.  It remains here so the old module can be
 * a thin re-export while preserving its AGREED/CONFLICT result vocabulary.
 */
const LEGACY_METADATA_KINDS: readonly LegacyMetadataKind[] = [
  "expressionLineage",
  "predicates",
  "uniqueKeys",
  "functionalDependencies",
  "tableOccurrences",
  "rowCountCardinality",
];

function legacyCanonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return `[${value.map(legacyCanonical).sort(compareText).join(",")}]`;
  if (typeof value === "object" && value !== undefined) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${legacyCanonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function legacyNormalized(values: readonly unknown[]): readonly string[] {
  return values.map(legacyCanonical).sort(compareText);
}

function legacyValuesFrom(
  set: LegacyObservationSet,
  kind: LegacyMetadataKind,
): LegacyObservation {
  return set[kind] ?? { evaluated: false, values: [] };
}

function legacyResultFor(
  kind: LegacyMetadataKind,
  native: LegacyObservation,
  calcite: LegacyObservation,
  forceNotEvaluated = false,
  reason?: LegacyReason,
): LegacyResult {
  const nativeValues = [...native.values];
  const calciteValues = [...calcite.values];
  if (forceNotEvaluated)
    return {
      kind,
      status: "NOT_EVALUATED",
      nativeValues,
      calciteValues,
      ...(reason ? { reason } : {}),
    };

  let status: LegacyResult["status"];
  if (!native.evaluated && !calcite.evaluated) status = "NOT_EVALUATED";
  else if (native.evaluated && !calcite.evaluated) status = "NATIVE_ONLY";
  else if (!native.evaluated && calcite.evaluated)
    status = "CALCITE_ONLY_UNMAPPABLE";
  else if (
    legacyCanonical(legacyNormalized(nativeValues)) ===
    legacyCanonical(legacyNormalized(calciteValues))
  )
    status = "AGREED";
  else status = "CONFLICT";

  if (status !== "CONFLICT")
    return {
      kind,
      status,
      nativeValues,
      calciteValues,
      ...(status === "NOT_EVALUATED"
        ? {
            reason: reason ?? {
              code: "OBSERVATION_NOT_PROVIDED",
              message: `No ${kind} observation was evaluated by either side.`,
            },
          }
        : {}),
    };
  const nativeKeys = new Set(legacyNormalized(nativeValues));
  const calciteKeys = new Set(legacyNormalized(calciteValues));
  return {
    kind,
    status,
    nativeValues,
    calciteValues,
    conflict: {
      nativeOnly: nativeValues.filter((value) => !calciteKeys.has(legacyCanonical(value))),
      calciteOnly: calciteValues.filter((value) => !nativeKeys.has(legacyCanonical(value))),
    },
  };
}

export function reconcileLegacyDifferential(
  input: LegacyInput,
): LegacyReconciliation {
  return {
    results: LEGACY_METADATA_KINDS.map((kind) =>
      legacyResultFor(
        kind,
        legacyValuesFrom(input.native, kind),
        legacyValuesFrom(input.calcite, kind),
      ),
    ),
  };
}

function legacyEvaluatedObservations(
  observations: LegacyObservations | undefined,
): LegacyObservationSet {
  if (!observations) return {};
  return Object.fromEntries(
    LEGACY_METADATA_KINDS.filter((kind) => observations[kind] !== undefined).map(
      (kind) => [
        kind,
        {
          evaluated: true,
          values: observations[kind] ?? [],
        },
      ],
    ),
  ) as LegacyObservationSet;
}

export function reconcileLegacyCalciteResponse(
  native: LegacyObservationSet,
  response: LegacyResponse,
): LegacyReconciliation {
  const sidecarReason: LegacyReason = response.error ?? {
    code:
      response.status === "SUCCESS"
        ? "CALCITE_OBSERVATION_NOT_PROVIDED"
        : "CALCITE_SIDECAR_NOT_EVALUATED",
    message:
      response.status === "SUCCESS"
        ? "Calcite returned no observation for this metadata kind."
        : `Calcite sidecar status is ${response.status}.`,
  };
  const result =
    response.status === "SUCCESS"
      ? reconcileLegacyDifferential({
          native,
          calcite: legacyEvaluatedObservations(response.observations),
        })
      : {
          results: LEGACY_METADATA_KINDS.map((kind) =>
            legacyResultFor(
              kind,
              legacyValuesFrom(native, kind),
              { evaluated: false, values: [] },
              true,
              sidecarReason,
            ),
          ),
        };
  return {
    ...result,
    ...(response.fingerprint
      ? { fingerprint: response.fingerprint as LegacyFingerprint }
      : {}),
    sidecar: { status: response.status, error: response.error },
  };
}

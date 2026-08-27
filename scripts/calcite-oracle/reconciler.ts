import type {
  CalciteOracleFingerprint,
  CalciteOracleMetadataKind,
  CalciteOracleObservations,
  CalciteOracleResponse,
  DifferentialInput,
  DifferentialObservation,
  DifferentialObservationSet,
  DifferentialReconciliation,
  DifferentialResult,
  DifferentialStatus,
} from "./protocol.ts";

const METADATA_KINDS: readonly CalciteOracleMetadataKind[] = [
  "expressionLineage",
  "predicates",
  "uniqueKeys",
  "functionalDependencies",
  "tableOccurrences",
  "rowCountCardinality",
];

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function normalized(values: readonly unknown[]): readonly string[] {
  return values.map(canonical).sort();
}

function valuesFrom(
  set: DifferentialObservationSet,
  kind: CalciteOracleMetadataKind,
): DifferentialObservation {
  return set[kind] ?? { evaluated: false, values: [] };
}

function resultFor(
  kind: CalciteOracleMetadataKind,
  native: DifferentialObservation,
  calcite: DifferentialObservation,
  forceNotEvaluated = false,
): DifferentialResult {
  const nativeValues = [...native.values];
  const calciteValues = [...calcite.values];
  if (forceNotEvaluated) {
    return { kind, status: "NOT_EVALUATED", nativeValues, calciteValues };
  }

  let status: DifferentialStatus;

  if (!native.evaluated && !calcite.evaluated) {
    status = "NOT_EVALUATED";
  } else if (native.evaluated && !calcite.evaluated) {
    status = "NATIVE_ONLY";
  } else if (!native.evaluated && calcite.evaluated) {
    status = "CALCITE_ONLY_UNMAPPABLE";
  } else if (canonical(normalized(nativeValues)) === canonical(normalized(calciteValues))) {
    status = "AGREED";
  } else {
    status = "CONFLICT";
  }

  if (status !== "CONFLICT") {
    return { kind, status, nativeValues, calciteValues };
  }

  const nativeKeys = new Set(normalized(nativeValues));
  const calciteKeys = new Set(normalized(calciteValues));
  return {
    kind,
    status,
    nativeValues,
    calciteValues,
    conflict: {
      nativeOnly: nativeValues.filter((value) => !calciteKeys.has(canonical(value))),
      calciteOnly: calciteValues.filter((value) => !nativeKeys.has(canonical(value))),
    },
  };
}

/**
 * Compare already-normalized native observations with an offline Calcite
 * observation. This function is deliberately pure and never receives or
 * returns a canonical artifact.
 */
export function reconcileDifferential(input: DifferentialInput): DifferentialReconciliation {
  return {
    results: METADATA_KINDS.map((kind) =>
      resultFor(kind, valuesFrom(input.native, kind), valuesFrom(input.calcite, kind)),
    ),
  };
}

function evaluatedObservations(
  observations: CalciteOracleObservations | undefined,
): DifferentialObservationSet {
  if (!observations) return {};
  return Object.fromEntries(
    METADATA_KINDS.filter((kind) => observations[kind] !== undefined).map((kind) => [kind, {
      evaluated: true,
      values: observations[kind] ?? [],
    }]),
  ) as DifferentialObservationSet;
}

/** Adapt a successful/unsupported/failed sidecar response for pure comparison. */
export function reconcileCalciteResponse(
  native: DifferentialObservationSet,
  response: CalciteOracleResponse,
): DifferentialReconciliation {
  const result = response.status === "SUCCESS"
    ? reconcileDifferential({ native, calcite: evaluatedObservations(response.observations) })
    : {
        results: METADATA_KINDS.map((kind) =>
          resultFor(kind, valuesFrom(native, kind), { evaluated: false, values: [] }, true),
        ),
      };
  return response.fingerprint === undefined
    ? {
        ...result,
        sidecar: { status: response.status, error: response.error },
      }
    : {
        ...result,
        fingerprint: response.fingerprint as CalciteOracleFingerprint,
        sidecar: { status: response.status, error: response.error },
      };
}

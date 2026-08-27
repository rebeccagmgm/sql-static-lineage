import type {
  CalciteCanonicalSourceEvidence,
  CalciteOccurrenceMapping,
  CalciteOracleFingerprint,
  CalciteOracleResponse,
  CalciteNativeOperatorBatch,
  CalciteSemanticObservation,
  DifferentialReason,
  NativeSemanticObservation,
} from "../../../calcite-oracle/protocol.ts";
import {
  CALCITE_NATIVE_OPERATOR_BATCHES,
} from "../../../calcite-oracle/protocol.ts";

export type CalciteSemanticDifferentialStatus =
  | "NATIVE_CONFIRMED"
  | "CALCITE_CORROBORATED"
  | "CALCITE_ONLY_UNMAPPABLE"
  | "NOT_EVALUATED"
  | "SEMANTIC_ENGINE_CONFLICT";

export interface NativeOperatorBatchInput {
  readonly batch: CalciteNativeOperatorBatch;
  readonly observations: readonly NativeSemanticObservation[];
}

export interface CalciteOperatorBatchInput extends NativeOperatorBatchInput {
  /** Omit only when the Calcite sidecar was not evaluated. */
  readonly calcite?: readonly CalciteSemanticObservation[];
  readonly calciteStatus?: "SUCCESS" | "UNSUPPORTED" | "FAILED";
  readonly calciteReason?: DifferentialReason;
  readonly occurrenceMappings?: readonly CalciteOccurrenceMapping[];
}

export interface CalciteSemanticDifferentialResult {
  readonly batch: CalciteNativeOperatorBatch;
  readonly status: CalciteSemanticDifferentialStatus;
  readonly identityKey?: string;
  readonly nativeObservationIds: readonly string[];
  readonly calciteObservationIds: readonly string[];
  readonly nativeObservations: readonly NativeSemanticObservation[];
  readonly calciteObservations: readonly CalciteSemanticObservation[];
  readonly nativeValues: readonly unknown[];
  readonly calciteValues: readonly unknown[];
  readonly reason?: DifferentialReason;
  readonly conflict?: {
    readonly nativeOnly: readonly unknown[];
    readonly calciteOnly: readonly unknown[];
  };
}

export interface CalciteSemanticBatchResult {
  readonly batch: CalciteNativeOperatorBatch;
  readonly status: CalciteSemanticDifferentialStatus;
  readonly results: readonly CalciteSemanticDifferentialResult[];
  readonly reason?: DifferentialReason;
}

export interface CalciteSemanticMappingReport {
  readonly fingerprint?: CalciteOracleFingerprint;
  readonly batches: readonly CalciteSemanticBatchResult[];
  /** Flattened results are convenient for status-based release gates. */
  readonly results: readonly CalciteSemanticDifferentialResult[];
}

export const CURRENT_NATIVE_OPERATOR_BATCHES =
  CALCITE_NATIVE_OPERATOR_BATCHES;

const BATCH_OPERATORS: Readonly<
  Record<CalciteNativeOperatorBatch, readonly string[]>
> = {
  EXPRESSION_CONTROLS: [
    "PROJECT:CASE",
    "PROJECT:IF",
    "PROJECT:COALESCE",
    "PROJECT:COLUMN_EXPRESSION",
  ],
  FILTERS_AND_JOINS: [
    "FILTER:WHERE",
    "FILTER:HAVING",
    "FILTER:QUALIFY",
    "JOIN:INNER",
    "JOIN:LEFT",
    "JOIN:RIGHT",
    "JOIN:FULL",
    "JOIN:SEMI",
    "JOIN:ANTI",
    "JOIN:CROSS",
  ],
  AGGREGATE_GROUPING_DISTINCT_SETOP: [
    "AGGREGATE:GROUP_BY",
    "AGGREGATE:AGGREGATE_INPUT",
    "AGGREGATE:COUNT_STAR",
    "DISTINCT:DISTINCT_KEY",
    "SETOP:UNION",
    "SETOP:UNION_ALL",
    "SETOP:INTERSECT",
    "SETOP:EXCEPT",
  ],
  WINDOW_TOP_N: [
    "WINDOW:WINDOW_VALUE",
    "WINDOW:WINDOW_PARTITION_BY",
    "WINDOW:WINDOW_ORDER_BY",
    "WINDOW:WINDOW_FRAME",
    "TOP_N:LIMIT",
    "TOP_N:TOP",
    "TOP_N:FETCH",
  ],
  RELATION_CONTEXT: [
    "AGGREGATE:COUNT_STAR",
    "SUBQUERY:EXISTS",
    "SUBQUERY:IN",
    "JOIN:CROSS",
    "RELATION:CROSS_JOIN",
    "RELATION:LITERAL_FROM_RELATION",
  ],
};

const BATCH_OPERATOR_ROLES: Readonly<Record<string, readonly string[]>> = {
  "PROJECT:COLUMN_EXPRESSION": ["VALUE"],
  "PROJECT:CASE": ["BRANCH_SELECTOR", "BRANCH_VALUE"],
  "PROJECT:IF": ["BRANCH_SELECTOR", "BRANCH_VALUE"],
  "PROJECT:COALESCE": ["BRANCH_SELECTOR", "BRANCH_VALUE"],
  "FILTER:WHERE": ["PREDICATE"],
  "FILTER:HAVING": ["PREDICATE"],
  "FILTER:QUALIFY": ["PREDICATE"],
  "JOIN:INNER": ["JOIN_CONDITION"],
  "JOIN:LEFT": ["JOIN_CONDITION"],
  "JOIN:RIGHT": ["JOIN_CONDITION"],
  "JOIN:FULL": ["JOIN_CONDITION"],
  "JOIN:SEMI": ["JOIN_CONDITION"],
  "JOIN:ANTI": ["JOIN_CONDITION"],
  "JOIN:CROSS": ["LEFT_INPUT", "RIGHT_INPUT"],
  "AGGREGATE:GROUP_BY": ["GROUP_KEY"],
  "AGGREGATE:AGGREGATE_INPUT": ["AGGREGATE_ARGUMENT"],
  "AGGREGATE:COUNT_STAR": ["RELATION"],
  "DISTINCT:DISTINCT_KEY": ["VALUE"],
  "SETOP:UNION": ["SET_MEMBER"],
  "SETOP:UNION_ALL": ["SET_MEMBER"],
  "SETOP:INTERSECT": ["SET_MEMBER"],
  "SETOP:EXCEPT": ["SET_MEMBER"],
  "WINDOW:WINDOW_VALUE": ["WINDOW_INPUT"],
  "WINDOW:WINDOW_PARTITION_BY": ["PARTITION_KEY"],
  "WINDOW:WINDOW_ORDER_BY": ["ORDER_KEY"],
  "WINDOW:WINDOW_FRAME": ["FRAME_BOUND"],
  "TOP_N:LIMIT": ["RANK_LIMIT", "ORDER_KEY"],
  "TOP_N:TOP": ["RANK_LIMIT", "ORDER_KEY"],
  "TOP_N:FETCH": ["RANK_LIMIT", "ORDER_KEY"],
  "SUBQUERY:EXISTS": ["RELATION"],
  "SUBQUERY:IN": ["RELATION"],
  "RELATION:CROSS_JOIN": ["CARDINALITY"],
  "RELATION:LITERAL_FROM_RELATION": ["RELATION"],
};

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function evidenceKey(evidence: CalciteCanonicalSourceEvidence): string {
  return canonical(evidence);
}

function valuesOf(
  observation: NativeSemanticObservation | CalciteSemanticObservation,
): readonly unknown[] {
  if (observation.values !== undefined) return [...observation.values];
  return observation.value === undefined ? [] : [observation.value];
}

function valueKeys(values: readonly unknown[]): readonly string[] {
  return values.map(canonical).sort();
}

function sameValues(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return canonical(valueKeys(left)) === canonical(valueKeys(right));
}

function exactIdentityKey(
  identity: {
    readonly batch: CalciteNativeOperatorBatch;
    readonly relationOccurrenceId: string;
    readonly fieldId?: string;
    readonly fieldOrdinal?: number;
    readonly outputOrdinal?: number;
    readonly operatorKind: string;
    readonly operatorVariant: string;
    readonly operatorRole: string;
    readonly sourceEvidence: CalciteCanonicalSourceEvidence;
  },
): string {
  return canonical({
    batch: identity.batch,
    relationOccurrenceId: identity.relationOccurrenceId,
    fieldId: identity.fieldId ?? null,
    fieldOrdinal: identity.fieldOrdinal ?? null,
    outputOrdinal: identity.outputOrdinal ?? null,
    operatorKind: identity.operatorKind,
    operatorVariant: identity.operatorVariant,
    operatorRole: identity.operatorRole,
    sourceEvidence: identity.sourceEvidence,
  });
}

function validSourceEvidence(
  evidence: CalciteCanonicalSourceEvidence | undefined,
): boolean {
  const span = evidence?.sourceSpan;
  return (
    evidence !== undefined &&
    typeof evidence.canonicalSource === "string" &&
    span !== undefined &&
    Number.isInteger(span.start) &&
    Number.isInteger(span.end) &&
    span.start >= 0 &&
    span.end >= span.start
  );
}

function observationReason(
  observation: {
    readonly batch: CalciteNativeOperatorBatch;
    readonly relationOccurrenceId: string;
    readonly fieldId?: string;
    readonly fieldOrdinal?: number;
    readonly outputOrdinal?: number;
    readonly operatorKind: string;
    readonly operatorVariant: string;
    readonly operatorRole: string;
    readonly sourceEvidence: CalciteCanonicalSourceEvidence;
  },
): DifferentialReason | null {
  if (!observation.relationOccurrenceId)
    return {
      code: "RELATION_OCCURRENCE_MISSING",
      message: "Calcite observation has no relation occurrence identity.",
    };
  const hasFieldOrdinal =
    typeof observation.fieldId === "string" &&
    observation.fieldId.length > 0 &&
    Number.isInteger(observation.fieldOrdinal);
  const hasOutputOrdinal = Number.isInteger(observation.outputOrdinal);
  if (!hasFieldOrdinal && !hasOutputOrdinal)
    return {
      code: "FIELD_OR_OUTPUT_ORDINAL_MISSING",
      message:
        "Calcite observation has neither an exact field ordinal nor output ordinal.",
    };
  if (
    !observation.operatorKind ||
    !observation.operatorVariant ||
    !observation.operatorRole
  )
    return {
      code: "OPERATOR_IDENTITY_MISSING",
      message: "Calcite observation has an incomplete operator identity.",
    };
  if (!validSourceEvidence(observation.sourceEvidence))
    return {
      code: "CANONICAL_SOURCE_EVIDENCE_MISSING",
      message:
        "Calcite observation has no complete canonical source text and span.",
    };
  return null;
}

function operatorIsInBatch(
  batch: CalciteNativeOperatorBatch,
  observation: {
    readonly operatorKind: string;
    readonly operatorVariant: string;
    readonly operatorRole: string;
  },
): boolean {
  const operatorKey = `${observation.operatorKind}:${observation.operatorVariant}`;
  return (
    BATCH_OPERATORS[batch].includes(operatorKey) &&
    (BATCH_OPERATOR_ROLES[operatorKey] ?? []).includes(observation.operatorRole)
  );
}

function reasonResult(
  batch: CalciteNativeOperatorBatch,
  status: CalciteSemanticDifferentialStatus,
  reason: DifferentialReason,
  nativeObservations: readonly NativeSemanticObservation[] = [],
  calciteObservations: readonly CalciteSemanticObservation[] = [],
): CalciteSemanticDifferentialResult {
  return {
    batch,
    status,
    nativeObservationIds: nativeObservations.map(
      (observation) => observation.observationId,
    ),
    calciteObservationIds: calciteObservations.map(
      (observation) => observation.observationId,
    ),
    nativeObservations: [...nativeObservations],
    calciteObservations: [...calciteObservations],
    nativeValues: nativeObservations.flatMap(valuesOf),
    calciteValues: calciteObservations.flatMap(valuesOf),
    reason,
  };
}

function conflictResult(
  batch: CalciteNativeOperatorBatch,
  identityKey: string,
  nativeObservations: readonly NativeSemanticObservation[],
  calciteObservations: readonly CalciteSemanticObservation[],
): CalciteSemanticDifferentialResult {
  const nativeValues = nativeObservations.flatMap(valuesOf);
  const calciteValues = calciteObservations.flatMap(valuesOf);
  const nativeKeys = new Set(nativeValues.map(canonical));
  const calciteKeys = new Set(calciteValues.map(canonical));
  return {
    batch,
    status: "SEMANTIC_ENGINE_CONFLICT",
    identityKey,
    nativeObservationIds: nativeObservations.map(
      (observation) => observation.observationId,
    ),
    calciteObservationIds: calciteObservations.map(
      (observation) => observation.observationId,
    ),
    nativeObservations: [...nativeObservations],
    calciteObservations: [...calciteObservations],
    nativeValues,
    calciteValues,
    reason: {
      code: "SEMANTIC_ENGINE_CONFLICT",
      message:
        "Native and Calcite observations share an exact identity but disagree on their semantic value.",
    },
    conflict: {
      nativeOnly: nativeValues.filter((value) => !calciteKeys.has(canonical(value))),
      calciteOnly: calciteValues.filter((value) => !nativeKeys.has(canonical(value))),
    },
  };
}

function occurrenceIdFor(
  observation: CalciteSemanticObservation,
  mappings: readonly CalciteOccurrenceMapping[],
): { readonly id?: string; readonly reason?: DifferentialReason } {
  const matches = mappings.filter(
    (mapping) =>
      mapping.calciteRelationOccurrenceId === observation.relationOccurrenceId,
  );
  if (matches.length > 1) {
    const ids = new Set(matches.map((mapping) => mapping.nativeRelationOccurrenceId));
    if (ids.size > 1)
      return {
        reason: {
          code: "AMBIGUOUS_RELATION_OCCURRENCE_MAPPING",
          message:
            "Calcite relation occurrence maps to more than one Native occurrence.",
        },
      };
  }
  if (matches.length > 0)
    return mappingIdFor(observation, matches[0]!);
  // An equal id is an exact identity mapping, not a table-name heuristic.
  if (observation.relationOccurrenceId)
    return { id: observation.relationOccurrenceId };
  return {
    reason: {
      code: "RELATION_OCCURRENCE_NOT_MAPPED",
      message: "Calcite relation occurrence has no exact Native mapping.",
    },
  };
}

function mappingIdFor(
  observation: CalciteSemanticObservation,
  mapping: CalciteOccurrenceMapping,
): { readonly id?: string; readonly reason?: DifferentialReason } {
  if (mapping.sourceEvidence !== undefined) {
    if (observation.relationSourceEvidence === undefined)
      return {
        reason: {
          code: "RELATION_SOURCE_EVIDENCE_MISSING",
          message:
            "The explicit relation occurrence mapping requires relation source evidence.",
        },
      };
    if (
      evidenceKey(mapping.sourceEvidence) !==
      evidenceKey(observation.relationSourceEvidence)
    )
      return {
        reason: {
          code: "RELATION_SOURCE_EVIDENCE_MISMATCH",
          message:
            "Calcite relation occurrence source evidence does not match the explicit mapping.",
        },
      };
  }
  return { id: mapping.nativeRelationOccurrenceId };
}

function batchStatus(
  results: readonly CalciteSemanticDifferentialResult[],
): CalciteSemanticDifferentialStatus {
  if (results.some((result) => result.status === "SEMANTIC_ENGINE_CONFLICT"))
    return "SEMANTIC_ENGINE_CONFLICT";
  if (results.some((result) => result.status === "NOT_EVALUATED"))
    return "NOT_EVALUATED";
  if (results.some((result) => result.status === "CALCITE_ONLY_UNMAPPABLE"))
    return "CALCITE_ONLY_UNMAPPABLE";
  if (results.length > 0 && results.every((result) => result.status === "CALCITE_CORROBORATED"))
    return "CALCITE_CORROBORATED";
  return "NATIVE_CONFIRMED";
}

function reconcileBatch(
  input: CalciteOperatorBatchInput,
): CalciteSemanticBatchResult {
  const native = [...input.observations];
  const calcite = [...(input.calcite ?? [])];
  const sidecarStatus = input.calciteStatus ?? "SUCCESS";
  if (sidecarStatus !== "SUCCESS") {
    const reason = input.calciteReason ?? {
      code: "CALCITE_SIDECAR_NOT_EVALUATED",
      message: `Calcite sidecar status is ${sidecarStatus}.`,
    };
    const results = native.map((observation) =>
      reasonResult(input.batch, "NOT_EVALUATED", reason, [observation]),
    );
    return {
      batch: input.batch,
      status: "NOT_EVALUATED",
      results,
      reason,
    };
  }
  if (calcite.length === 0) {
    const reason = input.calciteReason ?? {
      code: "CALCITE_BATCH_OBSERVATIONS_MISSING",
      message:
        "Calcite succeeded but returned no first-class semantic observation for this batch.",
    };
    const results = native.map((observation) =>
      reasonResult(input.batch, "NOT_EVALUATED", reason, [observation]),
    );
    return {
      batch: input.batch,
      status: "NOT_EVALUATED",
      results,
      reason,
    };
  }

  const mappings = input.occurrenceMappings ?? [];
  const usableCalcite: Array<{
    readonly observation: CalciteSemanticObservation;
    readonly key: string;
  }> = [];
  const results: CalciteSemanticDifferentialResult[] = [];
  for (const observation of calcite) {
    const structuralReason = observationReason(observation);
    if (structuralReason) {
      results.push(
        reasonResult(
          input.batch,
          "NOT_EVALUATED",
          structuralReason,
          [],
          [observation],
        ),
      );
      continue;
    }
    if (observation.batch !== input.batch || !operatorIsInBatch(input.batch, observation)) {
      results.push(
        reasonResult(
          input.batch,
          "NOT_EVALUATED",
          {
            code: "UNSUPPORTED_OPERATOR_FOR_BATCH",
            message: `Calcite operator ${observation.operatorKind}:${observation.operatorVariant} is not evaluated in ${input.batch}.`,
          },
          [],
          [observation],
        ),
      );
      continue;
    }
    const occurrence = occurrenceIdFor(observation, mappings);
    if (occurrence.reason || !occurrence.id) {
      results.push(
        reasonResult(
          input.batch,
          "CALCITE_ONLY_UNMAPPABLE",
          occurrence.reason ?? {
            code: "RELATION_OCCURRENCE_NOT_MAPPED",
            message: "Calcite relation occurrence has no exact Native mapping.",
          },
          [],
          [observation],
        ),
      );
      continue;
    }
    const mappedIdentity = { ...observation, relationOccurrenceId: occurrence.id };
    usableCalcite.push({
      observation,
      key: exactIdentityKey(mappedIdentity),
    });
  }

  const nativeByKey = new Map<string, NativeSemanticObservation[]>();
  for (const observation of native) {
    const structuralReason = observationReason(observation);
    if (structuralReason) {
      results.push(reasonResult(input.batch, "NOT_EVALUATED", structuralReason, [observation]));
      continue;
    }
    if (observation.batch !== input.batch || !operatorIsInBatch(input.batch, observation)) {
      results.push(
        reasonResult(
          input.batch,
          "NOT_EVALUATED",
          {
            code: "UNSUPPORTED_NATIVE_OPERATOR_FOR_BATCH",
            message: `Native operator ${observation.operatorKind}:${observation.operatorVariant} is not evaluated in ${input.batch}.`,
          },
          [observation],
        ),
      );
      continue;
    }
    const key = exactIdentityKey(observation);
    const previous = nativeByKey.get(key) ?? [];
    previous.push(observation);
    nativeByKey.set(key, previous);
  }

  const matchedCalciteKeys = new Set<string>();
  for (const [key, nativeObservations] of nativeByKey) {
    const calciteObservations = usableCalcite
      .filter((item) => item.key === key)
      .map((item) => item.observation);
    if (calciteObservations.length === 0) {
      results.push(
        reasonResult(
          input.batch,
          "NATIVE_CONFIRMED",
          {
            code: "NO_EXACT_CALCITE_OBSERVATION",
            message:
              "No Calcite observation matched relation occurrence, field/output ordinal, operator, and source evidence exactly.",
          },
          nativeObservations,
        ),
      );
      continue;
    }
    matchedCalciteKeys.add(key);
    results.push(
      sameValues(
        nativeObservations.flatMap(valuesOf),
        calciteObservations.flatMap(valuesOf),
      )
        ? {
            batch: input.batch,
            status: "CALCITE_CORROBORATED",
            identityKey: key,
            nativeObservationIds: nativeObservations.map(
              (observation) => observation.observationId,
            ),
            calciteObservationIds: calciteObservations.map(
              (observation) => observation.observationId,
            ),
            nativeObservations: [...nativeObservations],
            calciteObservations: [...calciteObservations],
            nativeValues: nativeObservations.flatMap(valuesOf),
            calciteValues: calciteObservations.flatMap(valuesOf),
          }
        : conflictResult(input.batch, key, nativeObservations, calciteObservations),
    );
  }

  for (const item of usableCalcite) {
    if (nativeByKey.has(item.key) && matchedCalciteKeys.has(item.key)) continue;
    results.push(
      reasonResult(
        input.batch,
        "CALCITE_ONLY_UNMAPPABLE",
        {
          code: "NO_EXACT_NATIVE_OBSERVATION",
          message:
            "Calcite observation did not map to a Native observation with the exact required identity.",
        },
        [],
        [item.observation],
      ),
    );
  }

  const orderedResults = [...results].sort((left, right) =>
    `${left.status}:${left.identityKey ?? ""}`.localeCompare(
      `${right.status}:${right.identityKey ?? ""}`,
    ),
  );
  return {
    batch: input.batch,
    status: batchStatus(orderedResults),
    results: orderedResults,
  };
}

/**
 * Reconcile all current Native operator batches. Missing batches are explicit
 * NOT_EVALUATED results, so a caller cannot mistake an omitted fixture for an
 * empty successful Calcite evaluation.
 */
export function reconcileCalciteSemanticBatches(
  inputs: readonly CalciteOperatorBatchInput[],
  fingerprint?: CalciteOracleFingerprint,
): CalciteSemanticMappingReport {
  const byBatch = new Map(inputs.map((input) => [input.batch, input]));
  const batches: CalciteSemanticBatchResult[] = [];
  for (const batch of CALCITE_NATIVE_OPERATOR_BATCHES) {
    const input = byBatch.get(batch);
    if (!input) {
      const reason: DifferentialReason = {
        code: "NATIVE_BATCH_NOT_PROVIDED",
        message: `No Native/Calcite differential input was provided for ${batch}.`,
      };
      batches.push({ batch, status: "NOT_EVALUATED", results: [], reason });
    } else batches.push(reconcileBatch(input));
  }
  const results = batches.flatMap((batch) => batch.results);
  return {
    ...(fingerprint ? { fingerprint } : {}),
    batches,
    results,
  };
}

/** Alias emphasizing that Calcite observations are mapped before comparison. */
export const mapCalciteSemanticObservations = reconcileCalciteSemanticBatches;

/** Adapt the JSONL oracle response without changing the canonical Native input. */
export function reconcileCalciteResponseWithSemanticMapping(input: {
  readonly nativeBatches: readonly NativeOperatorBatchInput[];
  readonly response: CalciteOracleResponse;
  readonly occurrenceMappings?: readonly CalciteOccurrenceMapping[];
}): CalciteSemanticMappingReport {
  const observations = input.response.observations?.semanticObservations ?? [];
  const batches = input.nativeBatches.map((nativeBatch) => ({
    ...nativeBatch,
    calcite: observations.filter((observation) => observation.batch === nativeBatch.batch),
    calciteStatus: input.response.status,
    ...(input.response.error
      ? {
          calciteReason: {
            code: input.response.error.code,
            message: input.response.error.message,
          },
        }
      : {}),
    occurrenceMappings: input.occurrenceMappings,
  }));
  return reconcileCalciteSemanticBatches(batches, input.response.fingerprint);
}

export function canonicalCalciteSemanticIdentityKey(
  identity: Parameters<typeof exactIdentityKey>[0],
): string {
  return exactIdentityKey(identity);
}

export function canonicalCalciteSourceEvidenceKey(
  evidence: CalciteCanonicalSourceEvidence,
): string {
  return evidenceKey(evidence);
}

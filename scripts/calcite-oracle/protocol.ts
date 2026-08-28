/** Stable, sidecar-only protocol types for the Calcite differential oracle. */

export const CALCITE_ORACLE_PROTOCOL_VERSION = 1 as const;
export const CALCITE_ORACLE_VERSION = "1.42.0" as const;

export type CalciteOracleStatus = "SUCCESS" | "UNSUPPORTED" | "FAILED";

/** The Native semantic batches covered by the current causal-slice rules. */
export const CALCITE_NATIVE_OPERATOR_BATCHES = [
  "EXPRESSION_CONTROLS",
  "FILTERS_AND_JOINS",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "WINDOW_TOP_N",
  "RELATION_CONTEXT",
] as const;

export type CalciteNativeOperatorBatch =
  (typeof CALCITE_NATIVE_OPERATOR_BATCHES)[number];

/** A source reference is exact: no whitespace or span normalization is done. */
export interface CalciteCanonicalSourceEvidence {
  readonly canonicalSource: string;
  readonly sourceSpan: {
    readonly start: number;
    readonly end: number;
  };
  readonly sourceEvidenceId?: string;
}

/**
 * The identity used to join a Calcite observation back to Native evidence.
 * `fieldOrdinal` identifies an input field and `outputOrdinal` identifies an
 * output expression; a relation-context observation may use outputOrdinal
 * without a physical field id.
 */
export interface CalciteSemanticIdentity {
  readonly batch: CalciteNativeOperatorBatch;
  readonly relationOccurrenceId: string;
  readonly fieldId?: string;
  readonly fieldOrdinal?: number;
  readonly outputOrdinal?: number;
  readonly operatorKind: string;
  readonly operatorVariant: string;
  readonly operatorRole: string;
  readonly sourceEvidence: CalciteCanonicalSourceEvidence;
}

export interface NativeSemanticObservation extends CalciteSemanticIdentity {
  readonly observationId: string;
  readonly values?: readonly unknown[];
  readonly value?: unknown;
}

/**
 * `relationOccurrenceId` is the Calcite-side occurrence until the mapping
 * layer resolves it. Equal ids are accepted as an explicit identity mapping;
 * otherwise an occurrence mapping must be supplied.
 */
export interface CalciteSemanticObservation extends CalciteSemanticIdentity {
  readonly observationId: string;
  /** Optional exact source evidence for the relation scan itself. */
  readonly relationSourceEvidence?: CalciteCanonicalSourceEvidence;
  readonly values?: readonly unknown[];
  readonly value?: unknown;
}

export interface CalciteOccurrenceMapping {
  readonly calciteRelationOccurrenceId: string;
  readonly nativeRelationOccurrenceId: string;
  /** Optional exact evidence for the relation occurrence itself. */
  readonly sourceEvidence?: CalciteCanonicalSourceEvidence;
}

export interface DifferentialReason {
  readonly code: string;
  readonly message: string;
}

export type CalciteOracleMetadataKind =
  | "expressionLineage"
  | "predicates"
  | "uniqueKeys"
  | "functionalDependencies"
  | "tableOccurrences"
  | "rowCountCardinality";

export interface CalciteOracleColumn {
  readonly name: string;
  readonly type?: string;
  readonly nullable?: boolean;
}

export interface CalciteOracleTable {
  readonly catalog?: string;
  readonly schema?: string;
  readonly name: string;
  readonly columns: readonly CalciteOracleColumn[];
  readonly rowCount?: number;
  readonly uniqueKeys?: readonly (readonly string[])[];
  readonly functionalDependencies?: readonly CalciteOracleFunctionalDependency[];
}

export interface CalciteOracleFunctionalDependency {
  readonly determinant: readonly string[];
  readonly dependent: readonly string[];
}

export interface CalciteOracleSchema {
  readonly tables: readonly CalciteOracleTable[];
}

export interface CalciteOracleLimits {
  readonly maxInputBytes?: number;
  readonly maxSqlBytes?: number;
  readonly maxTables?: number;
  readonly maxColumnsPerTable?: number;
  readonly maxOutputItems?: number;
  readonly maxOutputBytes?: number;
}

export interface CalciteOracleRequest {
  readonly protocolVersion: typeof CALCITE_ORACLE_PROTOCOL_VERSION;
  readonly requestId?: string;
  readonly dialect?: "ANSI" | "HIVE";
  readonly sql: string;
  readonly schema: CalciteOracleSchema;
  readonly requestedMetadata?: readonly CalciteOracleMetadataKind[];
  readonly limits?: CalciteOracleLimits;
}

export interface CalciteOracleExpressionLineage {
  readonly nodeId: string;
  readonly outputOrdinal: number;
  readonly expression: string;
  readonly lineage: readonly string[] | null;
}

export interface CalciteOraclePredicate {
  readonly nodeId: string;
  readonly predicate: string;
  readonly source: "FILTER" | "PULLED_UP";
}

export interface CalciteOracleUniqueKey {
  readonly nodeId: string;
  readonly columns: readonly string[];
}

export interface CalciteOracleFunctionalDependencyObservation {
  readonly nodeId: string;
  readonly determinant: readonly string[];
  readonly dependent: readonly string[];
  readonly source: "SCHEMA_STATISTICS" | "CALCITE_METADATA";
}

export interface CalciteOracleTableOccurrence {
  readonly occurrenceId: string;
  readonly qualifiedName: readonly string[];
  readonly nodeId: string;
}

export interface CalciteOracleRowCountCardinality {
  readonly nodeId: string;
  readonly rowCount: number | null;
  readonly cardinality: Readonly<Record<string, number | null>>;
}

export interface CalciteOracleObservations {
  readonly expressionLineage?: readonly CalciteOracleExpressionLineage[];
  readonly predicates?: readonly CalciteOraclePredicate[];
  readonly uniqueKeys?: readonly CalciteOracleUniqueKey[];
  readonly functionalDependencies?: readonly CalciteOracleFunctionalDependencyObservation[];
  readonly tableOccurrences?: readonly CalciteOracleTableOccurrence[];
  readonly rowCountCardinality?: readonly CalciteOracleRowCountCardinality[];
  /** First-class operator observations emitted by the differential adapter. */
  readonly semanticObservations?: readonly CalciteSemanticObservation[];
}

export interface CalciteOracleFingerprint {
  readonly tool: "calcite-offline-oracle";
  readonly calciteVersion: typeof CALCITE_ORACLE_VERSION;
  readonly protocolVersion: typeof CALCITE_ORACLE_PROTOCOL_VERSION;
  readonly buildFingerprint: string;
}

export interface CalciteOracleResponse {
  readonly protocolVersion: typeof CALCITE_ORACLE_PROTOCOL_VERSION;
  readonly requestId?: string;
  readonly status: CalciteOracleStatus;
  readonly fingerprint: CalciteOracleFingerprint;
  readonly observations?: CalciteOracleObservations;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export type DifferentialMetadataKind = CalciteOracleMetadataKind;

export interface DifferentialObservation<T = unknown> {
  readonly evaluated: boolean;
  readonly values: readonly T[];
}

export type DifferentialObservationSet = Readonly<
  Partial<Record<DifferentialMetadataKind, DifferentialObservation>>
>;

export interface DifferentialInput {
  readonly native: DifferentialObservationSet;
  readonly calcite: DifferentialObservationSet;
}

export type DifferentialStatus =
  | "AGREED"
  | "NATIVE_ONLY"
  | "CALCITE_ONLY_UNMAPPABLE"
  | "NOT_EVALUATED"
  | "CONFLICT"
  // Current spec statuses. The legacy values above remain for old consumers.
  | "NATIVE_CONFIRMED"
  | "CALCITE_CORROBORATED"
  | "SEMANTIC_ENGINE_CONFLICT";

export interface DifferentialResult {
  readonly kind: DifferentialMetadataKind;
  readonly status: DifferentialStatus;
  readonly nativeValues: readonly unknown[];
  readonly calciteValues: readonly unknown[];
  readonly conflict?: {
    readonly nativeOnly: readonly unknown[];
    readonly calciteOnly: readonly unknown[];
  };
  readonly reason?: DifferentialReason;
}

export interface DifferentialReconciliation {
  readonly fingerprint?: CalciteOracleFingerprint;
  readonly sidecar?: {
    readonly status: CalciteOracleStatus;
    readonly error?: {
      readonly code: string;
      readonly message: string;
    };
  };
  readonly results: readonly DifferentialResult[];
}

/**
 * @deprecated Import the versioned protocol from
 * `scripts/calcite-differential/protocol.ts` for new code.  These exports are
 * additive compatibility aliases; the legacy oracle request/response types
 * above remain unchanged for existing callers.
 */
export {
  CALCITE_DIFFERENTIAL_BUILD_FINGERPRINT,
  CALCITE_DIFFERENTIAL_CALCITE_VERSION,
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  CALCITE_DIFFERENTIAL_TOOL,
  DIFFERENTIAL_HARD_LIMITS,
  DIFFERENTIAL_METADATA_KINDS,
  DIFFERENTIAL_OBSERVATION_STATUSES,
  DIFFERENTIAL_REQUEST_KINDS,
  DIFFERENTIAL_RESPONSE_STATUSES,
  DIFFERENTIAL_RESULT_STATUSES,
  makeDifferentialFingerprint,
  parseDifferentialJson,
  requestFingerprint,
  resolveDifferentialLimits,
  serializeDifferentialRequest,
  serializeDifferentialResponse,
  sha256Text,
  stableJsonLine,
  stableSerialize,
  validateDifferentialRequest,
} from "../calcite-differential/protocol.ts";

export type {
  DifferentialEvaluation,
  DifferentialFingerprint,
  DifferentialIssue,
  DifferentialMappingRef,
  DifferentialObservationStatus,
  DifferentialProtocolError,
  DifferentialRequest,
  DifferentialResponse,
  DifferentialValidationResult,
  PlanFactsRelRequest,
  RawSqlDifferentialRequest,
  ResolvedDifferentialLimits,
} from "../calcite-differential/protocol.ts";

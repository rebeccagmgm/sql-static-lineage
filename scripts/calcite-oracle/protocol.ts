/** Stable, sidecar-only protocol types for the Calcite differential oracle. */

export const CALCITE_ORACLE_PROTOCOL_VERSION = 1 as const;
export const CALCITE_ORACLE_VERSION = "1.42.0" as const;

export type CalciteOracleStatus = "SUCCESS" | "UNSUPPORTED" | "FAILED";

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
  | "CONFLICT";

export interface DifferentialResult {
  readonly kind: DifferentialMetadataKind;
  readonly status: DifferentialStatus;
  readonly nativeValues: readonly unknown[];
  readonly calciteValues: readonly unknown[];
  readonly conflict?: {
    readonly nativeOnly: readonly unknown[];
    readonly calciteOnly: readonly unknown[];
  };
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

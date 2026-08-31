import { createHash } from "node:crypto";

/**
 * Native-side declaration of the versioned Plan Facts wire shape.
 *
 * Full Calcite protocol validation and differential reconciliation live in the
 * independent Sidecar. This module only lets Native projection code create a
 * deterministic request without importing Sidecar source or its runtime.
 */
export const PLAN_FACTS_REL_GRAPH_VERSION = 1 as const;
export const CALCITE_DIFFERENTIAL_PROTOCOL_VERSION = 1 as const;
export const CALCITE_DIFFERENTIAL_CALCITE_VERSION = "1.42.0" as const;
export const CALCITE_DIFFERENTIAL_TOOL = "calcite-differential" as const;
export const CALCITE_DIFFERENTIAL_BUILD_FINGERPRINT =
  "calcite-differential-ts/0.1.0;calcite/1.42.0;protocol/1" as const;

export interface RelSourceSpan {
  readonly start: number;
  readonly end: number;
}

export interface RelEvidenceIdentity {
  readonly mappingId: string;
  readonly evidenceRefs: readonly string[];
  readonly sourceSpan?: RelSourceSpan;
}

export interface ConcreteSqlType {
  readonly status: "CONCRETE";
  readonly name: string;
  readonly nullable: boolean;
  readonly precision?: number;
  readonly scale?: number;
}

export interface RelOutputField extends RelEvidenceIdentity {
  readonly ordinal: number;
  readonly name: string;
  readonly type: ConcreteSqlType;
  readonly nativeFieldId?: string;
  readonly sourceBinding?: string;
}

interface RelExpressionBase extends RelEvidenceIdentity {
  readonly expressionId: string;
}

export interface RelFieldRefExpression extends RelExpressionBase {
  readonly kind: "FIELD_REF";
  readonly type: ConcreteSqlType;
  readonly inputNodeId: string;
  readonly inputOrdinal: number;
  readonly nativeFieldId?: string;
  readonly sourceBinding?: string;
}

export interface RelLiteralExpression extends RelExpressionBase {
  readonly kind: "LITERAL";
  readonly type: ConcreteSqlType;
  readonly value: string | number | boolean | null;
}

export interface RelCallExpression extends RelExpressionBase {
  readonly kind: "CALL";
  readonly type: ConcreteSqlType;
  readonly operator: string;
  readonly operands: readonly RelTypedExpression[];
}

export interface RelCastExpression extends RelExpressionBase {
  readonly kind: "CAST";
  readonly type: ConcreteSqlType;
  readonly operand: RelTypedExpression;
}

export interface RelCaseBranch {
  readonly ordinal: number;
  readonly selector: RelTypedExpression;
  readonly result: RelTypedExpression;
}

export interface RelCaseExpression extends RelExpressionBase {
  readonly kind: "CASE";
  readonly type: ConcreteSqlType;
  readonly subject?: RelTypedExpression;
  readonly branches: readonly RelCaseBranch[];
  readonly elseResult?: RelTypedExpression;
}

export interface RelUnsupportedExpression extends RelExpressionBase {
  readonly kind: "UNSUPPORTED";
  readonly reasonCode: string;
  readonly message: string;
}

export type RelTypedExpression =
  | RelFieldRefExpression
  | RelLiteralExpression
  | RelCallExpression
  | RelCastExpression
  | RelCaseExpression
  | RelUnsupportedExpression;

interface RelNodeBase extends RelEvidenceIdentity {
  readonly nodeId: string;
  readonly nativeRelationId: string;
  readonly nativeScopeId?: string;
  readonly outputFields: readonly RelOutputField[];
}

export interface RelReadNode extends RelNodeBase {
  readonly kind: "READ";
  readonly nativeRelationOccurrenceId: string;
  readonly table: {
    readonly catalog?: string;
    readonly schema?: string;
    readonly name: string;
  };
}

export interface RelDerivedNode extends RelNodeBase {
  readonly kind: "DERIVED";
  readonly sourceNodeId: string;
  readonly sourceKind: "CTE" | "SUBQUERY" | "RELATION" | "GRAPHTABLE" | "PIVOT";
}

export interface RelProjectNode extends RelNodeBase {
  readonly kind: "PROJECT";
  readonly inputNodeId: string;
  readonly expressions: readonly RelTypedExpression[];
}

export interface RelFilterNode extends RelNodeBase {
  readonly kind: "FILTER";
  readonly inputNodeId: string;
  readonly clause: "WHERE" | "HAVING" | "QUALIFY";
  readonly predicate: RelTypedExpression;
}

export type RelJoinType =
  | "INNER"
  | "LEFT"
  | "RIGHT"
  | "FULL"
  | "SEMI"
  | "ANTI"
  | "CROSS";

export interface RelJoinNode extends RelNodeBase {
  readonly kind: "JOIN";
  readonly leftNodeId: string;
  readonly rightNodeId: string;
  readonly joinType: RelJoinType;
  readonly condition?: RelTypedExpression;
}

export interface RelAggregateNode extends RelNodeBase {
  readonly kind: "AGGREGATE";
  readonly inputNodeId: string;
  readonly groupKeys: readonly RelTypedExpression[];
  readonly measures: readonly RelTypedExpression[];
}

export interface RelSetopNode extends RelNodeBase {
  readonly kind: "SETOP";
  readonly inputNodeIds: readonly string[];
  readonly operation: "UNION" | "INTERSECT" | "EXCEPT";
  readonly all: boolean;
  readonly byName: boolean;
}

export interface RelWindowNode extends RelNodeBase {
  readonly kind: "WINDOW";
  readonly inputNodeId: string;
  readonly expressions: readonly RelTypedExpression[];
}

export interface RelTopNOrderKey {
  readonly expression: RelTypedExpression;
  readonly direction: "ASC" | "DESC";
  readonly nulls: "FIRST" | "LAST" | "UNSPECIFIED";
}

export interface RelTopNNode extends RelNodeBase {
  readonly kind: "TOP_N";
  readonly inputNodeId: string;
  readonly orderBy: readonly RelTopNOrderKey[];
  readonly offset?: RelTypedExpression;
  readonly fetch?: RelTypedExpression;
  readonly withTies: boolean;
}

export interface RelUnsupportedNode extends RelNodeBase {
  readonly kind: "UNSUPPORTED";
  readonly reasonCode: string;
  readonly message: string;
  readonly inputNodeIds: readonly string[];
}

export type PlanFactsRelNode =
  | RelReadNode
  | RelDerivedNode
  | RelProjectNode
  | RelFilterNode
  | RelJoinNode
  | RelAggregateNode
  | RelSetopNode
  | RelWindowNode
  | RelTopNNode
  | RelUnsupportedNode;

export interface PlanFactsRelGraph {
  readonly graphVersion: typeof PLAN_FACTS_REL_GRAPH_VERSION;
  readonly taskId: string;
  readonly statementId: string;
  readonly nodes: readonly PlanFactsRelNode[];
  readonly rootNodeIds: readonly string[];
}

export interface PlanFactsRelProjectionIssue {
  readonly code: string;
  readonly message: string;
  readonly nativeRelationId?: string;
  readonly expressionId?: string;
  readonly evidenceRefs: readonly string[];
}

export type PlanFactsRelProjectionResult =
  | {
      readonly status: "SUCCESS";
      readonly graph: PlanFactsRelGraph;
      readonly issues: readonly [];
    }
  | {
      readonly status: "PARTIAL";
      readonly graph: PlanFactsRelGraph;
      readonly issues: readonly PlanFactsRelProjectionIssue[];
    }
  | {
      readonly status: "UNSUPPORTED";
      readonly graph: null;
      readonly issues: readonly PlanFactsRelProjectionIssue[];
    };

export interface DifferentialPhysicalTableIdentity {
  readonly platform: string;
  readonly dataSource: string;
  readonly stableTableId: string;
  readonly qualifiedName: string;
}

export interface DifferentialSchemaColumn {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly ordinal?: number;
  readonly evidenceRefs?: readonly string[];
}

export interface DifferentialSchemaTable {
  readonly catalog?: string;
  readonly schema?: string;
  readonly name: string;
  readonly columns: readonly DifferentialSchemaColumn[];
  readonly evidenceRefs?: readonly string[];
  readonly physicalTableIdentity?: DifferentialPhysicalTableIdentity;
}

export interface DifferentialSchema {
  readonly tables: readonly DifferentialSchemaTable[];
}

export interface DifferentialMappingRef {
  readonly mappingId: string;
  readonly nativeRelationId: string;
  readonly nativeRelationOccurrenceId: string;
  readonly nativeScopeId?: string;
  readonly nativeFieldId?: string;
  readonly nativeFieldOrdinal?: number;
  readonly nativeOutputOrdinal?: number;
  readonly evidenceRefs: readonly string[];
}

export interface PlanFactsRelRequest {
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly requestKind: "PLAN_FACTS_REL_V1";
  readonly fingerprint: string;
  readonly requestId?: string;
  readonly graphVersion: typeof PLAN_FACTS_REL_GRAPH_VERSION;
  readonly taskId: string;
  readonly statementId: string;
  readonly schema: DifferentialSchema;
  readonly relations: readonly PlanFactsRelNode[];
  readonly roots: readonly string[];
  readonly mappings: readonly DifferentialMappingRef[];
  readonly requestedMetadata?: readonly DifferentialMetadataKind[];
  readonly limits?: Readonly<Record<string, number>>;
}

export const DIFFERENTIAL_METADATA_KINDS = [
  "expressionLineage",
  "predicates",
  "uniqueKeys",
  "functionalDependencies",
  "tableOccurrences",
  "rowCountCardinality",
] as const;
export type DifferentialMetadataKind = (typeof DIFFERENTIAL_METADATA_KINDS)[number];

export type DifferentialObservationStatus = "EVALUATED" | "NOT_EVALUATED";

export interface DifferentialObservation {
  readonly observationId: string;
  readonly kind: DifferentialMetadataKind;
  readonly status: DifferentialObservationStatus;
  readonly mappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly value?: unknown;
  readonly values?: readonly unknown[];
}

export type DifferentialResponseStatus = "SUCCESS" | "UNSUPPORTED" | "FAILED";

export interface DifferentialIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "ERROR" | "WARNING";
  readonly path?: string;
  readonly relationId?: string;
  readonly expressionId?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface DifferentialFingerprint {
  readonly tool: typeof CALCITE_DIFFERENTIAL_TOOL;
  readonly calciteVersion: typeof CALCITE_DIFFERENTIAL_CALCITE_VERSION;
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly buildFingerprint: string;
  readonly inputFingerprint: string;
}

export interface DifferentialResponse {
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly requestKind: "RAW_SQL_V1" | "PLAN_FACTS_REL_V1";
  readonly requestId?: string;
  readonly status: DifferentialResponseStatus;
  readonly fingerprint: DifferentialFingerprint;
  readonly issues: readonly DifferentialIssue[];
  readonly mappingRefs: readonly DifferentialMappingRef[];
  readonly observations: readonly DifferentialObservation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Differential JSON cannot contain a non-finite number.");
    return value;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol")
    throw new Error("Differential JSON contains a non-JSON value.");
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  throw new Error("Differential JSON contains an unsupported value.");
}

/** Deterministic object-key ordering shared by the wire fingerprint contract. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value)) ?? "null";
}

export function requestFingerprint(value: unknown): string {
  if (!isRecord(value)) throw new Error("A differential request fingerprint requires an object.");
  const withoutFingerprint = { ...value };
  delete withoutFingerprint.fingerprint;
  return createHash("sha256").update(stableSerialize(withoutFingerprint), "utf8").digest("hex");
}

/** Native's only write-side protocol operation: deterministic Plan Facts JSONL. */
export function serializePlanFactsRelRequest(request: PlanFactsRelRequest): string {
  if (
    request.protocolVersion !== CALCITE_DIFFERENTIAL_PROTOCOL_VERSION ||
    request.requestKind !== "PLAN_FACTS_REL_V1"
  ) throw new Error("PLAN_FACTS_REL_V1 request envelope is invalid");
  if (request.fingerprint !== requestFingerprint(request))
    throw new Error("PLAN_FACTS_REL_V1 request fingerprint is invalid");
  return `${stableSerialize(request)}\n`;
}

export function makeDifferentialFingerprint(
  inputFingerprint: string,
  buildFingerprint = CALCITE_DIFFERENTIAL_BUILD_FINGERPRINT,
): DifferentialFingerprint {
  if (!inputFingerprint) throw new Error("inputFingerprint is required");
  return {
    tool: CALCITE_DIFFERENTIAL_TOOL,
    calciteVersion: CALCITE_DIFFERENTIAL_CALCITE_VERSION,
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    buildFingerprint,
    inputFingerprint,
  };
}

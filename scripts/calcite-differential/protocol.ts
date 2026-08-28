import { createHash } from "node:crypto";
import {
  PLAN_FACTS_REL_GRAPH_VERSION,
  validatePlanFactsRelGraph,
  type RelEvidenceIdentity,
  type RelOutputField,
  type RelTypedExpression,
  type PlanFactsRelNode,
} from "./plan-facts-rel-contract.ts";

/**
 * Versioned protocol constants for the optional Calcite differential lane.
 *
 * This module is intentionally independent from the canonical Plan Facts and
 * Machine Facts contracts.  It only describes the sidecar boundary.
 */
export const CALCITE_DIFFERENTIAL_PROTOCOL_VERSION = 1 as const;
export const CALCITE_DIFFERENTIAL_CALCITE_VERSION = "1.42.0" as const;
export const CALCITE_DIFFERENTIAL_TOOL = "calcite-differential" as const;
export const CALCITE_DIFFERENTIAL_BUILD_FINGERPRINT =
  "calcite-differential-ts/0.1.0;calcite/1.42.0;protocol/1" as const;

export const DIFFERENTIAL_REQUEST_KINDS = [
  "RAW_SQL_V1",
  "PLAN_FACTS_REL_V1",
] as const;
export type DifferentialRequestKind =
  (typeof DIFFERENTIAL_REQUEST_KINDS)[number];

export const DIFFERENTIAL_RESPONSE_STATUSES = [
  "SUCCESS",
  "UNSUPPORTED",
  "FAILED",
] as const;
export type DifferentialResponseStatus =
  (typeof DIFFERENTIAL_RESPONSE_STATUSES)[number];

export const DIFFERENTIAL_RESULT_STATUSES = [
  "NATIVE_CONFIRMED",
  "CALCITE_CORROBORATED",
  "NATIVE_ONLY",
  "CALCITE_ONLY_UNMAPPABLE",
  "NOT_EVALUATED",
  "SEMANTIC_ENGINE_CONFLICT",
] as const;
export type DifferentialResultStatus =
  (typeof DIFFERENTIAL_RESULT_STATUSES)[number];

/** Status emitted by Calcite for one raw observation; not a reconciliation conclusion. */
export const DIFFERENTIAL_OBSERVATION_STATUSES = [
  "EVALUATED",
  "NOT_EVALUATED",
] as const;
export type DifferentialObservationStatus =
  (typeof DIFFERENTIAL_OBSERVATION_STATUSES)[number];

export const DIFFERENTIAL_METADATA_KINDS = [
  "expressionLineage",
  "predicates",
  "uniqueKeys",
  "functionalDependencies",
  "tableOccurrences",
  "rowCountCardinality",
] as const;
export type DifferentialMetadataKind =
  (typeof DIFFERENTIAL_METADATA_KINDS)[number];

export type DifferentialIssueSeverity = "ERROR" | "WARNING";

export interface DifferentialIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: DifferentialIssueSeverity;
  readonly path?: string;
  readonly relationId?: string;
  readonly expressionId?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface DifferentialLimits {
  readonly maxInputBytes?: number;
  readonly maxSqlBytes?: number;
  readonly maxTables?: number;
  readonly maxColumnsPerTable?: number;
  readonly maxPlanNodes?: number;
  readonly maxExpressions?: number;
  readonly maxMappingRefs?: number;
  readonly maxOutputItems?: number;
  readonly maxOutputBytes?: number;
}

/** Hard upper bounds cannot be raised by a request.  Callers may lower them. */
export const DIFFERENTIAL_HARD_LIMITS = Object.freeze({
  // Large but still bounded Plan Facts JOIN graphs can exceed 1 MiB before
  // Calcite has a chance to evaluate them. Keep the sidecar finite while
  // allowing the real 209119-shaped relation graph through.
  maxInputBytes: 4 * 1024 * 1024,
  maxSqlBytes: 64 * 1024,
  maxTables: 128,
  maxColumnsPerTable: 256,
  maxPlanNodes: 1024,
  maxExpressions: 4096,
  maxMappingRefs: 8192,
  maxOutputItems: 8192,
  maxOutputBytes: 4 * 1024 * 1024,
} as const);

export type ResolvedDifferentialLimits = {
  readonly [K in keyof typeof DIFFERENTIAL_HARD_LIMITS]: number;
};

export interface DifferentialFingerprint {
  readonly tool: typeof CALCITE_DIFFERENTIAL_TOOL;
  readonly calciteVersion: typeof CALCITE_DIFFERENTIAL_CALCITE_VERSION;
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly buildFingerprint: string;
  readonly inputFingerprint: string;
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

export interface DifferentialObservation {
  readonly observationId: string;
  readonly kind: DifferentialMetadataKind;
  readonly status: DifferentialObservationStatus;
  readonly mappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly value?: unknown;
  readonly values?: readonly unknown[];
}

export interface DifferentialRequestBase<
  K extends DifferentialRequestKind = DifferentialRequestKind,
> {
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly requestKind: K;
  /** Fingerprint of the exact Native input object, not a semantic guess. */
  readonly fingerprint: string;
  readonly requestId?: string;
  readonly requestedMetadata?: readonly DifferentialMetadataKind[];
  readonly limits?: DifferentialLimits;
}

export interface DifferentialSchemaColumn {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly ordinal?: number;
  readonly evidenceRefs?: readonly string[];
}

/** Exact physical identity supplied by the Native catalog, not inferred by Calcite. */
export interface DifferentialPhysicalTableIdentity {
  readonly platform: string;
  readonly dataSource: string;
  readonly stableTableId: string;
  readonly qualifiedName: string;
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

export interface RawSqlDifferentialRequest
  extends DifferentialRequestBase<"RAW_SQL_V1"> {
  readonly dialect?: "ANSI" | "HIVE";
  readonly sql: string;
  readonly schema: DifferentialSchema;
}

/**
 * Protocol envelope for the Plan Facts lane.
 *
 * The detailed relation/expression projection is intentionally deferred to
 * the Plan Facts relational projection task.  Keeping this envelope here
 * lets the protocol validate and transport that lane without coupling the
 * sidecar to the canonical Plan Facts contract.
 */
export interface PlanFactsRelRequest
  extends DifferentialRequestBase<"PLAN_FACTS_REL_V1"> {
  readonly graphVersion: typeof PLAN_FACTS_REL_GRAPH_VERSION;
  readonly taskId: string;
  readonly statementId: string;
  readonly schema: DifferentialSchema;
  readonly relations: readonly PlanFactsRelNode[];
  readonly roots: readonly string[];
  readonly mappings: readonly DifferentialMappingRef[];
}

function mappedExpressionObjects(
  expression: RelTypedExpression,
): readonly RelEvidenceIdentity[] {
  switch (expression.kind) {
    case "CALL":
      return [expression, ...expression.operands.flatMap(mappedExpressionObjects)];
    case "CAST":
      return [expression, ...mappedExpressionObjects(expression.operand)];
    case "CASE":
      return [
        expression,
        ...(expression.subject ? mappedExpressionObjects(expression.subject) : []),
        ...expression.branches.flatMap((branch) => [
          ...mappedExpressionObjects(branch.selector),
          ...mappedExpressionObjects(branch.result),
        ]),
        ...(expression.elseResult
          ? mappedExpressionObjects(expression.elseResult)
          : []),
      ];
    default:
      return [expression];
  }
}

function nodeExpressions(node: PlanFactsRelNode): readonly RelTypedExpression[] {
  switch (node.kind) {
    case "PROJECT":
    case "WINDOW":
      return node.expressions;
    case "FILTER":
      return [node.predicate];
    case "JOIN":
      return node.condition ? [node.condition] : [];
    case "AGGREGATE":
      return [...node.groupKeys, ...node.measures];
    case "TOP_N":
      return [
        ...node.orderBy.map((item) => item.expression),
        ...(node.offset ? [node.offset] : []),
        ...(node.fetch ? [node.fetch] : []),
      ];
    default:
      return [];
  }
}

function validateGraphMappings(
  nodes: readonly PlanFactsRelNode[],
  mappingsValue: unknown,
  issues: DifferentialIssue[],
): void {
  if (!Array.isArray(mappingsValue)) return;
  const mappings = new Map<string, DifferentialMappingRef>();
  for (const candidate of mappingsValue) {
    if (!isRecord(candidate) || typeof candidate.mappingId !== "string") continue;
    mappings.set(candidate.mappingId, candidate as unknown as DifferentialMappingRef);
  }
  const validateObject = (
    value: RelEvidenceIdentity,
    node: PlanFactsRelNode,
    path: string,
    outputField?: RelOutputField,
  ): void => {
    const mapping = mappings.get(value.mappingId);
    if (!mapping) {
      issues.push(issue("GRAPH_MAPPING_REF_UNKNOWN", `Graph mapping ${value.mappingId} is not declared in request.mappings.`, `${path}.mappingId`));
      return;
    }
    if (mapping.nativeRelationId !== node.nativeRelationId)
      issues.push(issue("GRAPH_MAPPING_RELATION_MISMATCH", "Graph mapping nativeRelationId does not match the owning relation.", `${path}.mappingId`));
    if (
      node.nativeScopeId &&
      mapping.nativeScopeId &&
      mapping.nativeScopeId !== node.nativeScopeId
    )
      issues.push(issue("GRAPH_MAPPING_SCOPE_MISMATCH", "Graph mapping nativeScopeId does not match the owning relation.", `${path}.mappingId`));
    const missingEvidence = value.evidenceRefs.filter(
      (ref) => !mapping.evidenceRefs.includes(ref),
    );
    if (missingEvidence.length > 0)
      issues.push(issue("GRAPH_MAPPING_EVIDENCE_MISMATCH", `Graph evidence refs are not bound by mapping ${value.mappingId}: ${missingEvidence.join(", ")}.`, `${path}.evidenceRefs`));
    if (outputField && mapping.nativeOutputOrdinal !== outputField.ordinal)
      issues.push(issue("GRAPH_MAPPING_OUTPUT_ORDINAL_MISMATCH", "Output field mapping must carry the exact native output ordinal.", `${path}.mappingId`));
    if (
      "nativeFieldId" in value &&
      typeof value.nativeFieldId === "string" &&
      mapping.nativeFieldId !== value.nativeFieldId
    )
      issues.push(issue("GRAPH_MAPPING_FIELD_ID_MISMATCH", "Graph nativeFieldId does not match its mapping.", `${path}.mappingId`));
  };
  nodes.forEach((node, nodeIndex) => {
    const nodePath = `relations[${nodeIndex}]`;
    validateObject(node, node, nodePath);
    const nodeMapping = mappings.get(node.mappingId);
    if (
      node.kind === "READ" &&
      nodeMapping &&
      nodeMapping.nativeRelationOccurrenceId !== node.nativeRelationOccurrenceId
    )
      issues.push(issue("GRAPH_MAPPING_OCCURRENCE_MISMATCH", "Read mapping occurrence does not match the Native read occurrence.", `${nodePath}.mappingId`));
    node.outputFields.forEach((field, fieldIndex) =>
      validateObject(field, node, `${nodePath}.outputFields[${fieldIndex}]`, field),
    );
    nodeExpressions(node).flatMap(mappedExpressionObjects).forEach(
      (expression, expressionIndex) =>
        validateObject(expression, node, `${nodePath}.mappedExpressions[${expressionIndex}]`),
    );
  });
}

export type DifferentialRequest =
  | RawSqlDifferentialRequest
  | PlanFactsRelRequest;

export interface DifferentialResponse {
  readonly protocolVersion: typeof CALCITE_DIFFERENTIAL_PROTOCOL_VERSION;
  readonly requestKind: DifferentialRequestKind;
  readonly requestId?: string;
  readonly status: DifferentialResponseStatus;
  readonly fingerprint: DifferentialFingerprint;
  readonly issues: readonly DifferentialIssue[];
  readonly mappingRefs: readonly DifferentialMappingRef[];
  readonly observations: readonly DifferentialObservation[];
}

export interface DifferentialReason {
  readonly code: string;
  readonly message: string;
}

/** An already evaluated Native or Calcite observation set for reconciliation. */
export interface DifferentialEvaluation<T = unknown> {
  readonly evaluated: boolean;
  readonly values: readonly T[];
  /** Optional Native-side confirmation marker for mapping-aware consumers. */
  readonly confirmed?: boolean;
  readonly mappingRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly reason?: DifferentialReason;
}

export type DifferentialObservationSet = Readonly<
  Partial<Record<DifferentialMetadataKind, DifferentialEvaluation>>
>;

export interface DifferentialInput {
  readonly native: DifferentialObservationSet;
  readonly calcite: DifferentialObservationSet;
}

export interface DifferentialResult {
  readonly kind: DifferentialMetadataKind;
  readonly status: DifferentialResultStatus;
  readonly nativeValues: readonly unknown[];
  readonly calciteValues: readonly unknown[];
  readonly mappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly conflict?: {
    readonly nativeOnly: readonly unknown[];
    readonly calciteOnly: readonly unknown[];
  };
  readonly reason?: DifferentialReason;
}

export interface DifferentialReconciliation {
  readonly fingerprint?: DifferentialFingerprint;
  readonly sidecar?: {
    readonly status: DifferentialResponseStatus;
    readonly issues: readonly DifferentialIssue[];
  };
  readonly results: readonly DifferentialResult[];
}

export interface DifferentialValidationResult {
  readonly valid: boolean;
  readonly issues: readonly DifferentialIssue[];
  readonly limits: ResolvedDifferentialLimits;
}

export interface DifferentialParseSuccess {
  readonly ok: true;
  readonly request: DifferentialRequest;
  readonly issues: readonly [];
}

export interface DifferentialParseFailure {
  readonly ok: false;
  readonly issues: readonly DifferentialIssue[];
}

export type DifferentialParseResult =
  | DifferentialParseSuccess
  | DifferentialParseFailure;

export class DifferentialProtocolError extends Error {
  readonly code: string;
  readonly issues: readonly DifferentialIssue[];

  constructor(
    code: string,
    message: string,
    issues: readonly DifferentialIssue[] = [],
  ) {
    super(message);
    this.name = "DifferentialProtocolError";
    this.code = code;
    this.issues = issues;
  }
}

const LIMIT_KEYS = Object.keys(
  DIFFERENTIAL_HARD_LIMITS,
) as (keyof typeof DIFFERENTIAL_HARD_LIMITS)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function issue(
  code: string,
  message: string,
  path?: string,
  extra: Pick<DifferentialIssue, "relationId" | "expressionId" | "evidenceRefs"> = {},
): DifferentialIssue {
  return {
    code,
    message,
    severity: "ERROR",
    ...(path ? { path } : {}),
    ...extra,
  };
}

function uniqueIssues(issues: readonly DifferentialIssue[]): DifferentialIssue[] {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = stableSerialize(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new DifferentialProtocolError(
        "NON_FINITE_NUMBER",
        "Differential JSON cannot contain a non-finite number.",
      );
    return value;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol")
    throw new DifferentialProtocolError(
      "NON_JSON_VALUE",
      "Differential JSON contains a non-JSON value.",
    );
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  throw new DifferentialProtocolError(
    "NON_JSON_VALUE",
    "Differential JSON contains an unsupported value.",
  );
}

/** Deterministic compact JSON with sorted object keys and source-order arrays. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value)) ?? "null";
}

/** Deterministic UTF-8 JSONL encoding for one request or response. */
export function stableJsonLine(value: unknown): string {
  return `${stableSerialize(value)}\n`;
}

export function sha256Text(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function requestFingerprint(value: unknown): string {
  if (!isRecord(value))
    throw new DifferentialProtocolError(
      "REQUEST_NOT_OBJECT",
      "A differential request fingerprint requires an object.",
    );
  const withoutFingerprint = { ...value };
  delete withoutFingerprint.fingerprint;
  return sha256Text(stableSerialize(withoutFingerprint));
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

export function resolveDifferentialLimits(
  requested?: DifferentialLimits,
): { readonly limits: ResolvedDifferentialLimits; readonly issues: readonly DifferentialIssue[] } {
  const issues: DifferentialIssue[] = [];
  const resolved = { ...DIFFERENTIAL_HARD_LIMITS } as Record<
    keyof typeof DIFFERENTIAL_HARD_LIMITS,
    number
  >;
  for (const key of LIMIT_KEYS) {
    const value = requested?.[key];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value <= 0) {
      issues.push(
        issue(
          "LIMIT_INVALID",
          `${key} must be a positive safe integer.`,
          `limits.${key}`,
        ),
      );
      continue;
    }
    if (value > DIFFERENTIAL_HARD_LIMITS[key]) {
      issues.push(
        issue(
          "LIMIT_EXCEEDS_HARD_CAP",
          `${key}=${value} exceeds hard cap ${DIFFERENTIAL_HARD_LIMITS[key]}.`,
          `limits.${key}`,
        ),
      );
      continue;
    }
    resolved[key] = value;
  }
  return { limits: Object.freeze(resolved), issues: uniqueIssues(issues) };
}

function validateMetadataKinds(
  value: unknown,
  issues: DifferentialIssue[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(issue("METADATA_KINDS_INVALID", "requestedMetadata must be an array."));
    return;
  }
  const allowed = new Set<string>(DIFFERENTIAL_METADATA_KINDS);
  value.forEach((item, index) => {
    if (typeof item !== "string" || !allowed.has(item))
      issues.push(
        issue(
          "METADATA_KIND_UNSUPPORTED",
          `requestedMetadata[${index}] is not a supported metadata kind.`,
          `requestedMetadata[${index}]`,
        ),
      );
  });
}

function validateLimitsShape(
  value: unknown,
  issues: DifferentialIssue[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push(issue("LIMITS_INVALID", "limits must be an object.", "limits"));
    return;
  }
  const known = new Set<string>(LIMIT_KEYS);
  for (const key of Object.keys(value)) {
    if (!known.has(key))
      issues.push(
        issue(
          "LIMIT_UNSUPPORTED",
          `${key} is not a supported differential resource limit.`,
          `limits.${key}`,
        ),
      );
  }
}

function validateStringArray(
  value: unknown,
  issues: DifferentialIssue[],
  path: string,
): void {
  if (!Array.isArray(value)) {
    issues.push(issue("STRING_ARRAY_INVALID", `${path} must be an array.`, path));
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.length === 0)
      issues.push(
        issue(
          "STRING_ARRAY_ITEM_INVALID",
          `${path}[${index}] must be a non-empty string.`,
          `${path}[${index}]`,
        ),
      );
  });
}

function validateNonNegativeInteger(
  value: unknown,
  issues: DifferentialIssue[],
  path: string,
): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    issues.push(
      issue(
        "ORDINAL_INVALID",
        `${path} must be a non-negative safe integer.`,
        path,
      ),
    );
}

function validateMappingRefs(
  value: unknown,
  limits: ResolvedDifferentialLimits,
  issues: DifferentialIssue[],
  path: string,
): void {
  if (!Array.isArray(value)) {
    issues.push(issue("MAPPING_REFS_INVALID", `${path} must be an array.`, path));
    return;
  }
  if (value.length > limits.maxMappingRefs)
    issues.push(
      issue(
        "MAPPING_LIMIT_EXCEEDED",
        `${path} contains ${value.length} mapping refs; limit is ${limits.maxMappingRefs}.`,
        path,
      ),
    );
  const mappingIds = new Set<string>();
  value.forEach((mapping, index) => {
    const mappingPath = `${path}[${index}]`;
    if (!isRecord(mapping)) {
      issues.push(issue("MAPPING_REF_INVALID", "mapping ref must be an object.", mappingPath));
      return;
    }
    for (const key of [
      "mappingId",
      "nativeRelationId",
      "nativeRelationOccurrenceId",
    ]) {
      if (typeof mapping[key] !== "string" || !mapping[key])
        issues.push(
          issue(
            "MAPPING_IDENTITY_MISSING",
            `${key} is required on a mapping ref.`,
            `${mappingPath}.${key}`,
          ),
        );
    }
    if (typeof mapping.mappingId === "string") {
      if (mappingIds.has(mapping.mappingId))
        issues.push(
          issue(
            "MAPPING_ID_DUPLICATE",
            `mappingId ${mapping.mappingId} is duplicated.`,
            `${mappingPath}.mappingId`,
          ),
        );
      mappingIds.add(mapping.mappingId);
    }
    if (mapping.evidenceRefs === undefined)
      issues.push(
        issue(
          "MAPPING_EVIDENCE_REFS_MISSING",
          "mapping ref evidenceRefs is required, even when empty.",
          `${mappingPath}.evidenceRefs`,
        ),
      );
    else
      validateStringArray(mapping.evidenceRefs, issues, `${mappingPath}.evidenceRefs`);
    for (const key of [
      "nativeFieldOrdinal",
      "nativeOutputOrdinal",
    ]) {
      if (mapping[key] !== undefined)
        validateNonNegativeInteger(mapping[key], issues, `${mappingPath}.${key}`);
    }
  });
}

function validateSchema(
  schema: unknown,
  limits: ResolvedDifferentialLimits,
  issues: DifferentialIssue[],
  path = "schema",
): void {
  if (!isRecord(schema) || !Array.isArray(schema.tables)) {
    issues.push(issue("SCHEMA_INVALID", "schema.tables must be an array.", path));
    return;
  }
  if (schema.tables.length > limits.maxTables)
    issues.push(
      issue(
        "TABLE_LIMIT_EXCEEDED",
        `schema contains ${schema.tables.length} tables; limit is ${limits.maxTables}.`,
        `${path}.tables`,
      ),
    );
  schema.tables.forEach((table, tableIndex) => {
    const tablePath = `${path}.tables[${tableIndex}]`;
    if (!isRecord(table) || typeof table.name !== "string" || !table.name)
      issues.push(issue("SCHEMA_TABLE_INVALID", "schema table name is required.", tablePath));
    if (!isRecord(table) || !Array.isArray(table.columns)) {
      issues.push(issue("SCHEMA_COLUMNS_INVALID", "schema table columns must be an array.", tablePath));
      return;
    }
    if (table.physicalTableIdentity !== undefined) {
      const physical = table.physicalTableIdentity;
      if (
        !isRecord(physical) ||
        typeof physical.platform !== "string" ||
        !physical.platform ||
        typeof physical.dataSource !== "string" ||
        !physical.dataSource ||
        typeof physical.stableTableId !== "string" ||
        !physical.stableTableId ||
        typeof physical.qualifiedName !== "string" ||
        !physical.qualifiedName
      ) {
        issues.push(issue(
          "SCHEMA_PHYSICAL_IDENTITY_INVALID",
          "physicalTableIdentity must be a complete exact catalog identity.",
          `${tablePath}.physicalTableIdentity`,
        ));
      }
    }
    if (table.columns.length > limits.maxColumnsPerTable)
      issues.push(
        issue(
          "COLUMN_LIMIT_EXCEEDED",
          `schema table contains ${table.columns.length} columns; limit is ${limits.maxColumnsPerTable}.`,
          `${tablePath}.columns`,
        ),
      );
    table.columns.forEach((column, columnIndex) => {
      const columnPath = `${tablePath}.columns[${columnIndex}]`;
      if (
        !isRecord(column) ||
        typeof column.name !== "string" ||
        !column.name ||
        typeof column.type !== "string" ||
        !column.type ||
        typeof column.nullable !== "boolean"
      ) {
        issues.push(
          issue(
            "SCHEMA_COLUMN_INVALID",
            "schema columns require name, concrete type, and explicit nullable.",
            columnPath,
          ),
        );
      }
    });
  });
}

function validateConcreteTypes(
  value: unknown,
  issues: DifferentialIssue[],
  path: string,
): void {
  if (!isRecord(value)) return;
  const type = value.type;
  if (isRecord(type)) {
    const name = typeof type.name === "string" ? type.name.toUpperCase() : "";
    if (!name || name === "ANY" || name === "UNKNOWN")
      issues.push(issue("TYPE_NOT_CONCRETE", "Plan Facts relation type must be concrete; ANY/UNKNOWN is forbidden.", `${path}.type`));
    if (typeof type.nullable !== "boolean")
      issues.push(issue("TYPE_NULLABILITY_MISSING", "Plan Facts relation type requires explicit nullable.", `${path}.type.nullable`));
  } else if (typeof type === "string" && ["ANY", "UNKNOWN"].includes(type.toUpperCase())) {
    issues.push(issue("TYPE_NOT_CONCRETE", "Plan Facts relation type cannot be ANY or UNKNOWN.", `${path}.type`));
  }
}

function validatePlanFactsRelShape(
  request: Record<string, unknown>,
  limits: ResolvedDifferentialLimits,
  issues: DifferentialIssue[],
): void {
  if (Object.prototype.hasOwnProperty.call(request, "sql"))
    issues.push(
      issue(
        "SQL_STRING_FALLBACK_FORBIDDEN",
        "PLAN_FACTS_REL_V1 must not carry a raw SQL fallback.",
        "sql",
      ),
    );
  if (request.graphVersion !== PLAN_FACTS_REL_GRAPH_VERSION)
    issues.push(issue("GRAPH_VERSION_MISMATCH", `graphVersion must be ${PLAN_FACTS_REL_GRAPH_VERSION}.`, "graphVersion"));
  for (const ownerField of ["taskId", "statementId"] as const) {
    if (typeof request[ownerField] !== "string" || !request[ownerField])
      issues.push(issue("GRAPH_OWNER_ID_MISSING", `${ownerField} is required for stable Native ownership.`, ownerField));
  }
  validateSchema(request.schema, limits, issues);
  if (!Array.isArray(request.relations)) {
    issues.push(issue("RELATION_GRAPH_INVALID", "relations must be an array.", "relations"));
  } else {
    if (request.relations.length > limits.maxPlanNodes)
      issues.push(issue("PLAN_NODE_LIMIT_EXCEEDED", `relation graph contains ${request.relations.length} nodes; limit is ${limits.maxPlanNodes}.`, "relations"));
    let expressionCount = 0;
    request.relations.forEach((relation, index) => {
      const path = `relations[${index}]`;
      if (!isRecord(relation)) {
        issues.push(issue("RELATION_NODE_INVALID", "relation node must be an object.", path));
        return;
      }
      if (typeof relation.nodeId !== "string" || !relation.nodeId)
        issues.push(issue("RELATION_NODE_ID_MISSING", "relation nodeId is required.", `${path}.nodeId`));
      if (typeof relation.nativeRelationId !== "string" || !relation.nativeRelationId)
        issues.push(issue("NATIVE_RELATION_ID_MISSING", "nativeRelationId is required.", `${path}.nativeRelationId`));
      validateConcreteTypes(relation, issues, path);
      if (Array.isArray(relation.outputFields)) {
        expressionCount += relation.outputFields.length;
        relation.outputFields.forEach((field, fieldIndex) => validateConcreteTypes(field, issues, `${path}.outputFields[${fieldIndex}]`));
      }
      if (Array.isArray(relation.expressions)) {
        expressionCount += relation.expressions.length;
        relation.expressions.forEach((expression, expressionIndex) => validateConcreteTypes(expression, issues, `${path}.expressions[${expressionIndex}]`));
      }
    });
    if (expressionCount > limits.maxExpressions)
      issues.push(issue("EXPRESSION_LIMIT_EXCEEDED", `relation graph contains ${expressionCount} expressions/fields; limit is ${limits.maxExpressions}.`, "relations"));
  }
  if (!Array.isArray(request.roots))
    issues.push(issue("RELATION_ROOTS_INVALID", "roots must be an array.", "roots"));
  else validateStringArray(request.roots, issues, "roots");
  validateMappingRefs(request.mappings, limits, issues, "mappings");

  if (Array.isArray(request.relations) && Array.isArray(request.roots)) {
    try {
      const validation = validatePlanFactsRelGraph({
        graphVersion: request.graphVersion as typeof PLAN_FACTS_REL_GRAPH_VERSION,
        taskId: typeof request.taskId === "string" ? request.taskId : "",
        statementId: typeof request.statementId === "string" ? request.statementId : "",
        nodes: request.relations as readonly PlanFactsRelNode[],
        rootNodeIds: request.roots.filter(
          (root): root is string => typeof root === "string",
        ),
      });
      for (const contractIssue of validation.issues) {
        issues.push(
          issue(
            contractIssue.code,
            contractIssue.message,
            `relations.${contractIssue.path}`,
          ),
        );
      }
      if (validation.valid)
        validateGraphMappings(
          request.relations as readonly PlanFactsRelNode[],
          request.mappings,
          issues,
        );
    } catch (error) {
      issues.push(
        issue(
          "RELATION_CONTRACT_INVALID",
          `relation graph does not satisfy the Plan Facts relational contract: ${error instanceof Error ? error.message : String(error)}`,
          "relations",
        ),
      );
    }
  }
}

function validateRawSqlShape(
  request: Record<string, unknown>,
  limits: ResolvedDifferentialLimits,
  issues: DifferentialIssue[],
): void {
  if (typeof request.sql !== "string" || !request.sql)
    issues.push(issue("RAW_SQL_MISSING", "RAW_SQL_V1 requires a non-empty sql string.", "sql"));
  else if (Buffer.byteLength(request.sql, "utf8") > limits.maxSqlBytes)
    issues.push(issue("SQL_LIMIT_EXCEEDED", `sql exceeds maxSqlBytes=${limits.maxSqlBytes}.`, "sql"));
  validateSchema(request.schema, limits, issues);
}

/** Validate a parsed request without executing or consulting Calcite. */
export function validateDifferentialRequest(
  value: unknown,
): DifferentialValidationResult {
  const issues: DifferentialIssue[] = [];
  const record = isRecord(value) ? value : null;
  if (!record) {
    issues.push(issue("REQUEST_NOT_OBJECT", "Differential request must be a JSON object."));
    const resolved = resolveDifferentialLimits();
    return { valid: false, issues, limits: resolved.limits };
  }
  if (record.protocolVersion !== CALCITE_DIFFERENTIAL_PROTOCOL_VERSION)
    issues.push(issue("PROTOCOL_VERSION_MISMATCH", `protocolVersion must be ${CALCITE_DIFFERENTIAL_PROTOCOL_VERSION}.`, "protocolVersion"));
  if (!DIFFERENTIAL_REQUEST_KINDS.includes(record.requestKind as DifferentialRequestKind))
    issues.push(issue("UNSUPPORTED_REQUEST_KIND", "requestKind is not supported by this protocol.", "requestKind"));
  if (typeof record.fingerprint !== "string" || !record.fingerprint)
    issues.push(issue("REQUEST_FINGERPRINT_MISSING", "request fingerprint is required.", "fingerprint"));
  else {
    try {
      const expectedFingerprint = requestFingerprint(record);
      if (record.fingerprint !== expectedFingerprint)
        issues.push(
          issue(
            "REQUEST_FINGERPRINT_MISMATCH",
            "fingerprint must equal SHA-256 of the request with fingerprint removed.",
            "fingerprint",
          ),
        );
    } catch (error) {
      issues.push(
        issue(
          "REQUEST_FINGERPRINT_UNAVAILABLE",
          error instanceof Error ? error.message : String(error),
          "fingerprint",
        ),
      );
    }
  }
  if (record.requestId !== undefined && (typeof record.requestId !== "string" || !record.requestId))
    issues.push(issue("REQUEST_ID_INVALID", "requestId must be a non-empty string when present.", "requestId"));
  validateMetadataKinds(record.requestedMetadata, issues);
  validateLimitsShape(record.limits, issues);
  const resolved = resolveDifferentialLimits(record.limits as DifferentialLimits | undefined);
  issues.push(...resolved.issues);
  if (record.requestKind === "RAW_SQL_V1") validateRawSqlShape(record, resolved.limits, issues);
  if (record.requestKind === "PLAN_FACTS_REL_V1") validatePlanFactsRelShape(record, resolved.limits, issues);
  try {
    const bytes = Buffer.byteLength(stableSerialize(value), "utf8");
    if (bytes > resolved.limits.maxInputBytes)
      issues.push(issue("INPUT_LIMIT_EXCEEDED", `request is ${bytes} bytes; limit is ${resolved.limits.maxInputBytes}.`));
  } catch (error) {
    issues.push(issue("REQUEST_NOT_SERIALIZABLE", error instanceof Error ? error.message : String(error)));
  }
  const unique = uniqueIssues(issues);
  return { valid: unique.length === 0, issues: unique, limits: resolved.limits };
}

export function parseDifferentialJson(
  input: string | Uint8Array,
): DifferentialParseResult {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  if (bytes.byteLength > DIFFERENTIAL_HARD_LIMITS.maxInputBytes)
    return {
      ok: false,
      issues: [issue("INPUT_LIMIT_EXCEEDED", `physical JSONL line exceeds hard cap ${DIFFERENTIAL_HARD_LIMITS.maxInputBytes} bytes.`)],
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    return {
      ok: false,
      issues: [issue("MALFORMED_JSON", error instanceof Error ? error.message : String(error))],
    };
  }
  const validation = validateDifferentialRequest(parsed);
  if (!validation.valid) return { ok: false, issues: validation.issues };
  return { ok: true, request: parsed as DifferentialRequest, issues: [] };
}

export function serializeDifferentialRequest(
  request: DifferentialRequest,
  options: { readonly validate?: boolean } = {},
): string {
  if (options.validate !== false) {
    const validation = validateDifferentialRequest(request);
    if (!validation.valid)
      throw new DifferentialProtocolError(
        validation.issues[0]?.code ?? "REQUEST_INVALID",
        "Differential request validation failed.",
        validation.issues,
      );
  }
  return stableJsonLine(request);
}

function validateFingerprint(
  value: unknown,
  issues: DifferentialIssue[],
  path: string,
): void {
  if (!isRecord(value)) {
    issues.push(issue("FINGERPRINT_INVALID", "fingerprint must be an object.", path));
    return;
  }
  if (value.tool !== CALCITE_DIFFERENTIAL_TOOL)
    issues.push(
      issue(
        "FINGERPRINT_TOOL_MISMATCH",
        `fingerprint.tool must be ${CALCITE_DIFFERENTIAL_TOOL}.`,
        `${path}.tool`,
      ),
    );
  if (value.calciteVersion !== CALCITE_DIFFERENTIAL_CALCITE_VERSION)
    issues.push(
      issue(
        "CALCITE_VERSION_MISMATCH",
        `fingerprint.calciteVersion must be ${CALCITE_DIFFERENTIAL_CALCITE_VERSION}.`,
        `${path}.calciteVersion`,
      ),
    );
  if (value.protocolVersion !== CALCITE_DIFFERENTIAL_PROTOCOL_VERSION)
    issues.push(
      issue(
        "PROTOCOL_VERSION_MISMATCH",
        `fingerprint.protocolVersion must be ${CALCITE_DIFFERENTIAL_PROTOCOL_VERSION}.`,
        `${path}.protocolVersion`,
      ),
    );
  if (typeof value.buildFingerprint !== "string" || !value.buildFingerprint)
    issues.push(
      issue(
        "BUILD_FINGERPRINT_MISSING",
        "fingerprint.buildFingerprint must be a non-empty string.",
        `${path}.buildFingerprint`,
      ),
    );
  if (typeof value.inputFingerprint !== "string" || !value.inputFingerprint)
    issues.push(
      issue(
        "INPUT_FINGERPRINT_MISSING",
        "fingerprint.inputFingerprint must be a non-empty string.",
        `${path}.inputFingerprint`,
      ),
    );
}

function validateResponseIssues(
  value: unknown,
  issues: DifferentialIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push(issue("RESPONSE_ISSUES_INVALID", "issues must be an array.", "issues"));
    return;
  }
  value.forEach((entry, index) => {
    const path = `issues[${index}]`;
    if (!isRecord(entry)) {
      issues.push(issue("RESPONSE_ISSUE_INVALID", "response issue must be an object.", path));
      return;
    }
    if (typeof entry.code !== "string" || !entry.code)
      issues.push(issue("RESPONSE_ISSUE_CODE_MISSING", "response issue code is required.", `${path}.code`));
    if (typeof entry.message !== "string" || !entry.message)
      issues.push(issue("RESPONSE_ISSUE_MESSAGE_MISSING", "response issue message is required.", `${path}.message`));
    if (entry.severity !== "ERROR" && entry.severity !== "WARNING")
      issues.push(issue("RESPONSE_ISSUE_SEVERITY_INVALID", "response issue severity must be ERROR or WARNING.", `${path}.severity`));
    if (entry.evidenceRefs !== undefined)
      validateStringArray(entry.evidenceRefs, issues, `${path}.evidenceRefs`);
  });
}

function validateResponseObservations(
  value: unknown,
  mappingIds: ReadonlySet<string>,
  mappingEvidenceRefs: ReadonlySet<string>,
  issues: DifferentialIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push(issue("RESPONSE_OBSERVATIONS_INVALID", "observations must be an array.", "observations"));
    return;
  }
  const metadataKinds = new Set<string>(DIFFERENTIAL_METADATA_KINDS);
  const observationStatuses = new Set<string>(DIFFERENTIAL_OBSERVATION_STATUSES);
  value.forEach((entry, index) => {
    const path = `observations[${index}]`;
    if (!isRecord(entry)) {
      issues.push(issue("OBSERVATION_INVALID", "observation must be an object.", path));
      return;
    }
    if (typeof entry.observationId !== "string" || !entry.observationId)
      issues.push(issue("OBSERVATION_ID_MISSING", "observationId is required.", `${path}.observationId`));
    if (typeof entry.kind !== "string" || !metadataKinds.has(entry.kind))
      issues.push(issue("OBSERVATION_KIND_UNSUPPORTED", "observation kind is not supported.", `${path}.kind`));
    if (typeof entry.status !== "string" || !observationStatuses.has(entry.status))
      issues.push(issue("OBSERVATION_STATUS_INVALID", "observation status must be EVALUATED or NOT_EVALUATED; final reconciliation statuses are forbidden.", `${path}.status`));

    if (!Array.isArray(entry.mappingRefs))
      issues.push(issue("OBSERVATION_MAPPING_REFS_INVALID", "observation mappingRefs must be an array.", `${path}.mappingRefs`));
    else {
      validateStringArray(entry.mappingRefs, issues, `${path}.mappingRefs`);
      entry.mappingRefs.forEach((mappingId, mappingIndex) => {
        if (typeof mappingId === "string" && !mappingIds.has(mappingId))
          issues.push(
            issue(
              "MAPPING_REF_UNKNOWN",
              `observation references unknown mappingId ${mappingId}.`,
              `${path}.mappingRefs[${mappingIndex}]`,
            ),
          );
      });
    }

    if (!Array.isArray(entry.evidenceRefs))
      issues.push(issue("OBSERVATION_EVIDENCE_REFS_INVALID", "observation evidenceRefs must be an array.", `${path}.evidenceRefs`));
    else {
      validateStringArray(entry.evidenceRefs, issues, `${path}.evidenceRefs`);
      entry.evidenceRefs.forEach((evidenceRef, evidenceIndex) => {
        if (typeof evidenceRef === "string" && !mappingEvidenceRefs.has(evidenceRef))
          issues.push(
            issue(
              "EVIDENCE_REF_UNBOUND",
              `observation references evidenceRef ${evidenceRef} not carried by a response mapping.`,
              `${path}.evidenceRefs[${evidenceIndex}]`,
            ),
          );
      });
    }

    if (
      Array.isArray(entry.mappingRefs) &&
      entry.mappingRefs.length > 0 &&
      Array.isArray(entry.evidenceRefs) &&
      entry.evidenceRefs.length === 0
    )
      issues.push(
        issue(
          "OBSERVATION_EVIDENCE_REFS_MISSING",
          "a mapped observation must carry at least one evidence reference.",
          `${path}.evidenceRefs`,
        ),
      );
    if (entry.values !== undefined && !Array.isArray(entry.values))
      issues.push(issue("OBSERVATION_VALUES_INVALID", "observation values must be an array.", `${path}.values`));
  });
}

/** Validate a response before it crosses the differential process boundary. */
export function validateDifferentialResponse(
  value: unknown,
  requestedLimits?: DifferentialLimits,
): DifferentialValidationResult {
  const issues: DifferentialIssue[] = [];
  const resolved = resolveDifferentialLimits(requestedLimits);
  issues.push(...resolved.issues);
  if (!isRecord(value)) {
    issues.push(issue("RESPONSE_NOT_OBJECT", "Differential response must be a JSON object."));
    return { valid: false, issues: uniqueIssues(issues), limits: resolved.limits };
  }
  if (value.protocolVersion !== CALCITE_DIFFERENTIAL_PROTOCOL_VERSION)
    issues.push(issue("PROTOCOL_VERSION_MISMATCH", `protocolVersion must be ${CALCITE_DIFFERENTIAL_PROTOCOL_VERSION}.`, "protocolVersion"));
  if (!DIFFERENTIAL_REQUEST_KINDS.includes(value.requestKind as DifferentialRequestKind))
    issues.push(issue("UNSUPPORTED_REQUEST_KIND", "requestKind is not supported by this protocol.", "requestKind"));
  if (value.requestId !== undefined && (typeof value.requestId !== "string" || !value.requestId))
    issues.push(issue("REQUEST_ID_INVALID", "requestId must be a non-empty string when present.", "requestId"));
  if (!DIFFERENTIAL_RESPONSE_STATUSES.includes(value.status as DifferentialResponseStatus))
    issues.push(issue("RESPONSE_STATUS_INVALID", "status is not supported by this protocol.", "status"));

  validateFingerprint(value.fingerprint, issues, "fingerprint");
  validateResponseIssues(value.issues, issues);
  validateMappingRefs(value.mappingRefs, resolved.limits, issues, "mappingRefs");

  const mappingIds = new Set<string>();
  const mappingEvidenceRefs = new Set<string>();
  if (Array.isArray(value.mappingRefs))
    value.mappingRefs.forEach((mapping) => {
      if (!isRecord(mapping)) return;
      if (typeof mapping.mappingId === "string") mappingIds.add(mapping.mappingId);
      if (Array.isArray(mapping.evidenceRefs))
        mapping.evidenceRefs.forEach((evidenceRef) => {
          if (typeof evidenceRef === "string") mappingEvidenceRefs.add(evidenceRef);
        });
    });
  validateResponseObservations(value.observations, mappingIds, mappingEvidenceRefs, issues);

  if (
    value.status !== "SUCCESS" &&
    Array.isArray(value.observations) &&
    value.observations.length > 0
  )
    issues.push(
      issue(
        "RESPONSE_OBSERVATIONS_ON_NON_SUCCESS",
        "UNSUPPORTED or FAILED responses must not carry semantic observations.",
        "observations",
      ),
    );

  const outputItems =
    (Array.isArray(value.issues) ? value.issues.length : 0) +
    (Array.isArray(value.mappingRefs) ? value.mappingRefs.length : 0) +
    (Array.isArray(value.observations) ? value.observations.length : 0);
  if (outputItems > resolved.limits.maxOutputItems)
    issues.push(
      issue(
        "OUTPUT_ITEMS_LIMIT_EXCEEDED",
        `response contains ${outputItems} output items; limit is ${resolved.limits.maxOutputItems}.`,
      ),
    );

  try {
    const bytes = Buffer.byteLength(stableJsonLine(value), "utf8");
    if (bytes > resolved.limits.maxOutputBytes)
      issues.push(
        issue(
          "OUTPUT_LIMIT_EXCEEDED",
          `response is ${bytes} bytes; limit is ${resolved.limits.maxOutputBytes}.`,
        ),
      );
  } catch (error) {
    issues.push(issue("RESPONSE_NOT_SERIALIZABLE", error instanceof Error ? error.message : String(error)));
  }
  const unique = uniqueIssues(issues);
  return { valid: unique.length === 0, issues: unique, limits: resolved.limits };
}

export function serializeDifferentialResponse(
  response: DifferentialResponse,
  limits?: DifferentialLimits,
): string {
  const validation = validateDifferentialResponse(response, limits);
  if (!validation.valid)
    throw new DifferentialProtocolError(
      validation.issues[0]?.code ?? "RESPONSE_INVALID",
      "Differential response validation failed.",
      validation.issues,
    );
  return stableJsonLine(response);
}

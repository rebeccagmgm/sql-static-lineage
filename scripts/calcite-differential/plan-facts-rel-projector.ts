import type {
  ColumnRef,
  ExprSpec,
  PlanFacts,
  PlanRelation,
  PredicateOperand,
  PredicateTree,
  StructuredExpression,
} from "../plans/plan-contract.ts";
import {
  PLAN_FACTS_REL_GRAPH_VERSION,
  validatePlanFactsRelGraph,
  type ConcreteSqlType,
  type PlanFactsRelGraph,
  type PlanFactsRelNode,
  type PlanFactsRelProjectionIssue,
  type RelOutputField,
  type RelTypedExpression,
} from "./plan-facts-rel-contract.ts";
import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  requestFingerprint,
  validateDifferentialRequest,
  type DifferentialPhysicalTableIdentity,
  type DifferentialMappingRef,
  type PlanFactsRelRequest,
} from "./protocol.ts";
import type {
  SchemaTableIdentity,
  SchemaTypeFact,
  SchemaTypeProjectionResult,
} from "./schema-type-projection.ts";

export interface ProjectedOutputTypeBinding {
  readonly relationId: string;
  readonly ordinal: number;
  readonly type: ConcreteSqlType;
  readonly evidenceRefs: readonly string[];
  readonly nativeFieldId?: string;
}

export interface PlanFactsCoreProjectionInput {
  readonly taskId: string;
  readonly statementId: string;
  readonly planFacts: PlanFacts;
  readonly schemaProjection: SchemaTypeProjectionResult;
  readonly outputTypes?: readonly ProjectedOutputTypeBinding[];
  readonly relationEvidenceRefs: Readonly<Record<string, readonly string[]>>;
  readonly expressionEvidenceRefs: Readonly<Record<string, readonly string[]>>;
  readonly defaultSchema?: string;
}

export interface PlanFactsCoreProjectionResult {
  readonly status: "SUCCESS" | "PARTIAL" | "UNSUPPORTED";
  readonly graph: PlanFactsRelGraph | null;
  readonly mappings: readonly DifferentialMappingRef[];
  readonly request: PlanFactsRelRequest | null;
  readonly issues: readonly PlanFactsRelProjectionIssue[];
}

type ProjectionState = {
  readonly input: PlanFactsCoreProjectionInput;
  readonly relations: ReadonlyMap<string, PlanRelation>;
  readonly nodes: Map<string, PlanFactsRelNode>;
  readonly mappings: Map<string, DifferentialMappingRef>;
  readonly active: Set<string>;
  readonly issues: PlanFactsRelProjectionIssue[];
  readonly outputTypes: ReadonlyMap<string, ProjectedOutputTypeBinding>;
};

function outputTypeKey(relationId: string, ordinal: number): string {
  return `${relationId}\u0000${ordinal}`;
}

function projectionIssue(
  code: string,
  message: string,
  relationId: string,
  evidenceRefs: readonly string[],
  expressionId?: string,
): PlanFactsRelProjectionIssue {
  return {
    code,
    message,
    nativeRelationId: relationId,
    ...(expressionId ? { expressionId } : {}),
    evidenceRefs: [...evidenceRefs],
  };
}

function requiredEvidence(
  state: ProjectionState,
  relationId: string,
  key?: string,
): readonly string[] | null {
  const refs = key
    ? state.input.expressionEvidenceRefs[key]
    : state.input.relationEvidenceRefs[relationId];
  if (refs && refs.length > 0 && refs.every(Boolean)) return [...refs];
  state.issues.push(
    projectionIssue(
      "PROJECTION_EVIDENCE_MISSING",
      `Canonical evidence refs are required for ${key ?? relationId}.`,
      relationId,
      [],
      key,
    ),
  );
  return null;
}

function mappingId(
  input: PlanFactsCoreProjectionInput,
  relationId: string,
  role: string,
): string {
  return `mapping:${input.taskId}:${input.statementId}:${relationId}:${role}`;
}

function addMapping(
  state: ProjectionState,
  relation: PlanRelation,
  role: string,
  evidenceRefs: readonly string[],
  options: {
    readonly nativeFieldId?: string;
    readonly nativeOutputOrdinal?: number;
    readonly nativeRelationOccurrenceId?: string;
  } = {},
): string {
  const id = mappingId(state.input, relation.id, role);
  state.mappings.set(id, {
    mappingId: id,
    nativeRelationId: relation.id,
    nativeRelationOccurrenceId:
      options.nativeRelationOccurrenceId ?? relation.id,
    ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}),
    ...(options.nativeFieldId ? { nativeFieldId: options.nativeFieldId } : {}),
    ...(options.nativeOutputOrdinal === undefined
      ? {}
      : { nativeOutputOrdinal: options.nativeOutputOrdinal }),
    evidenceRefs: [...evidenceRefs],
  });
  return id;
}

function tableIdentity(raw: string, defaultSchema?: string): SchemaTableIdentity | null {
  const parts = raw.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1)
    return defaultSchema ? { schema: defaultSchema, name: parts[0]! } : { name: parts[0]! };
  if (parts.length === 2) return { schema: parts[0]!, name: parts[1]! };
  if (parts.length === 3)
    return { catalog: parts[0]!, schema: parts[1]!, name: parts[2]! };
  return null;
}

function identityParts(identity: SchemaTableIdentity): readonly string[] {
  return [identity.catalog, identity.schema, identity.name].filter(
    (part): part is string => part !== undefined,
  );
}

function sameIdentity(left: SchemaTableIdentity, right: SchemaTableIdentity): boolean {
  const a = identityParts(left).map((part) => part.toLowerCase());
  const b = identityParts(right).map((part) => part.toLowerCase());
  if (a.length === b.length) return a.every((part, index) => part === b[index]);
  if (a.length > b.length) return b.every((part, index) => part === a[a.length - b.length + index]);
  return a.every((part, index) => part === b[b.length - a.length + index]);
}

function exactIdentity(left: SchemaTableIdentity, right: SchemaTableIdentity): boolean {
  const a = identityParts(left).map((part) => part.toLowerCase());
  const b = identityParts(right).map((part) => part.toLowerCase());
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

/**
 * Plan Facts uses the scope path to identify a derived relation, while the
 * column facts inside that scope may still carry the physical table binding.
 * The final scope component is an alias only for a nested derived scope; the
 * structural components are deliberately excluded so this never invents an
 * alias for the root query or a set-op branch.
 */
function derivedScopeBinding(scopeId: string | undefined): string | undefined {
  const candidate = scopeId?.split(".").at(-1)?.trim();
  if (!candidate || /^(root|casttable|setop|b\d+)$/i.test(candidate)) return undefined;
  if (candidate.includes("(") || candidate.includes(")")) return undefined;
  return candidate;
}

function sameConcreteType(left: ConcreteSqlType, right: ConcreteSqlType): boolean {
  return left.status === right.status &&
    left.name === right.name &&
    left.nullable === right.nullable &&
    left.precision === right.precision &&
    left.scale === right.scale;
}

function schemaTypesForRead(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "read" }>,
): {
  readonly identity: SchemaTableIdentity;
  readonly facts: readonly SchemaTypeFact[];
  readonly physicalTableIdentity?: DifferentialPhysicalTableIdentity;
} | null {
  const identity = tableIdentity(relation.table, state.input.defaultSchema);
  if (!identity) {
    state.issues.push(projectionIssue("READ_TABLE_IDENTITY_INVALID", `Cannot represent table ${relation.table}.`, relation.id, []));
    return null;
  }
  const matches = state.input.schemaProjection.types.filter((fact) => sameIdentity(fact.table, identity));
  const tableKeys = new Set(matches.map((fact) => identityParts(fact.table).join(".").toLowerCase()));
  if (tableKeys.size !== 1 || matches.length === 0) {
    state.issues.push(projectionIssue(
      tableKeys.size > 1 ? "READ_TABLE_IDENTITY_AMBIGUOUS" : "READ_SCHEMA_TYPES_MISSING",
      `Exact typed schema is unavailable for ${relation.table}.`,
      relation.id,
      [],
    ));
    return null;
  }
  const physicalIdentities = new Map(
    matches
      .filter((fact) => fact.physicalTableIdentity !== undefined)
      .map((fact) => [
        JSON.stringify(fact.physicalTableIdentity),
        fact.physicalTableIdentity!,
      ] as const),
  );
  return {
    identity: matches[0]!.table,
    facts: [...matches].sort((left, right) => left.column.ordinal - right.column.ordinal),
    ...(physicalIdentities.size === 1
      ? { physicalTableIdentity: [...physicalIdentities.values()][0] }
      : {}),
  };
}

function physicalTableFieldId(
  table: DifferentialPhysicalTableIdentity | undefined,
  column: string,
): string | undefined {
  if (!table) return undefined;
  return [
    table.platform,
    table.dataSource,
    table.stableTableId,
    table.qualifiedName,
    column,
  ].join("|");
}

function outputField(
  state: ProjectionState,
  relation: PlanRelation,
  ordinal: number,
  name: string,
  type: ConcreteSqlType,
  evidenceRefs: readonly string[],
  nativeFieldId?: string,
  sourceBinding?: string,
): RelOutputField {
  const id = addMapping(state, relation, `output:${ordinal}`, evidenceRefs, {
    nativeOutputOrdinal: ordinal,
    ...(nativeFieldId ? { nativeFieldId } : {}),
    ...(relation.type === "read"
      ? { nativeRelationOccurrenceId: relation.read_occurrence_id }
      : {}),
  });
  return {
    ordinal,
    name,
    type,
    mappingId: id,
    evidenceRefs: [...evidenceRefs],
    ...(nativeFieldId ? { nativeFieldId } : {}),
    ...(sourceBinding ? { sourceBinding } : {}),
  };
}

function nodeOutputByName(
  state: ProjectionState,
  node: PlanFactsRelNode,
  name: string,
  qualifier: string | undefined,
  relationId: string,
  evidenceRefs: readonly string[],
): RelOutputField | null {
  const named = node.outputFields.filter((field) => field.name.toLowerCase() === name.toLowerCase());
  const matches = qualifier
    ? named.filter((field) => field.sourceBinding?.toLowerCase() === qualifier.toLowerCase())
    : named;
  if (matches.length === 1) return matches[0]!;
  state.issues.push(projectionIssue(
    matches.length === 0 ? "INPUT_FIELD_MISSING" : "INPUT_FIELD_AMBIGUOUS",
    `Input field ${qualifier ? `${qualifier}.` : ""}${name} is not uniquely addressable on ${node.nodeId}.`,
    relationId,
    evidenceRefs,
  ));
  return null;
}

function expressionBase(
  state: ProjectionState,
  relation: PlanRelation,
  expressionId: string,
  evidenceRefs: readonly string[],
  options: {
    readonly nativeFieldId?: string;
  } = {},
): { readonly expressionId: string; readonly mappingId: string; readonly evidenceRefs: readonly string[] } {
  return {
    expressionId,
    mappingId: addMapping(
      state,
      relation,
      `expression:${expressionId}`,
      evidenceRefs,
      options,
    ),
    evidenceRefs: [...evidenceRefs],
  };
}

function parseLiteral(value: string | null, type: ConcreteSqlType): string | number | boolean | null | undefined {
  if (value === null || /^null$/i.test(value.trim())) return null;
  const text = value.trim();
  if (type.name === "BOOLEAN") {
    if (/^true$/i.test(text)) return true;
    if (/^false$/i.test(text)) return false;
    return undefined;
  }
  if (["TINYINT", "SMALLINT", "INTEGER", "BIGINT", "FLOAT", "REAL", "DOUBLE", "DECIMAL"].includes(type.name)) {
    const number = Number(text);
    return Number.isFinite(number) ? number : undefined;
  }
  if (["CHAR", "VARCHAR"].includes(type.name)) {
    if (text.length >= 2 && text[0] === "'" && text.at(-1) === "'")
      return text.slice(1, -1).replaceAll("''", "'");
    return text;
  }
  return undefined;
}

function inferredLiteralType(text: string): ConcreteSqlType {
  const value = text.trim();
  if (/^true$/i.test(value) || /^false$/i.test(value))
    return { status: "CONCRETE", name: "BOOLEAN", nullable: false };
  if (/^[+-]?\d+$/u.test(value))
    return { status: "CONCRETE", name: "INTEGER", nullable: false };
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/iu.test(value))
    return { status: "CONCRETE", name: "DECIMAL", precision: 38, scale: 18, nullable: false };
  if (/^null$/i.test(value))
    return { status: "CONCRETE", name: "VARCHAR", nullable: true };
  return { status: "CONCRETE", name: "VARCHAR", nullable: false };
}

function projectStructuredExpression(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "project" | "filter" | "join" }>,
  inputNode: PlanFactsRelNode,
  structured: StructuredExpression,
  expressionId: string,
  refs: readonly string[],
  expectedType: ConcreteSqlType,
): RelTypedExpression | null {
  if (structured.kind === "COLUMN") {
    const located = relation.type === "join"
      ? joinInputField(state, relation, structured.name, structured.qualifier, refs)
      : (() => {
          const field = nodeOutputByName(
            state,
            inputNode,
            structured.name,
            structured.qualifier,
            relation.id,
            refs,
          );
          return field ? { node: inputNode, field } : null;
        })();
    if (!located) return null;
    const { node, field } = located;
    return {
      kind: "FIELD_REF",
      ...expressionBase(state, relation, expressionId, refs, {
        ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      }),
      type: field.type,
      inputNodeId: node.nodeId,
      inputOrdinal: field.ordinal,
      ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      ...(field.sourceBinding ? { sourceBinding: field.sourceBinding } : {}),
    };
  }
  if (structured.kind === "LITERAL") {
    // Keep the enclosing semantic type when one is available.  This matters
    // for CASE/IF branches such as ELSE 0 in a DECIMAL expression: retaining
    // INTEGER here would make the Calcite bridge infer a different CASE type
    // even though the parser-owned output type is already authoritative.
    const type = expectedType ?? inferredLiteralType(structured.text);
    const value = parseLiteral(structured.text, type);
    if (value === undefined) {
      state.issues.push(projectionIssue(
        "PROJECT_LITERAL_UNSUPPORTED",
        `Literal ${structured.text} is not representable as a typed Calcite literal.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    return {
      kind: "LITERAL",
      ...expressionBase(state, relation, expressionId, refs),
      type: value === null ? { ...type, nullable: true } : type,
      value,
    };
  }
  if (structured.kind === "FUNCTION") {
    const normalizedName = structured.name.trim().toUpperCase();
    const operator = normalizedName === "SUBSTR"
      ? "SUBSTRING"
      : normalizedName === "IFNULL" || normalizedName === "NVL"
        ? "COALESCE"
        : normalizedName === "IIF"
          ? "IF"
          : normalizedName;
    if (operator !== "SUBSTRING" && operator !== "IF" && operator !== "COALESCE") {
      state.issues.push(projectionIssue(
        "PROJECT_FUNCTION_OPERATOR_UNSUPPORTED",
        `Function ${structured.name} is outside the typed Calcite projection subset.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    const operands = structured.args.map((operand, index) =>
      projectStructuredExpression(
        state,
        relation,
        inputNode,
        operand,
        `${expressionId}:arg:${index}`,
        refs,
        operator === "IF"
          ? index === 0
            ? { status: "CONCRETE", name: "BOOLEAN", nullable: true }
            : expectedType
          : operator === "SUBSTRING" && index > 0
            ? inferredLiteralType(operand.kind === "LITERAL" ? operand.text : "")
            : expectedType,
      ),
    );
    const validArity = operator === "IF"
      ? structured.args.length === 3
      : operator === "COALESCE"
        ? structured.args.length >= 2
        : structured.args.length >= 1;
    if (!validArity) {
      state.issues.push(projectionIssue(
        "PROJECT_FUNCTION_ARITY_INVALID",
        `${operator} has an invalid structured argument count.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    if (operands.some((operand) => operand === null)) return null;
    return {
      kind: "CALL",
      ...expressionBase(state, relation, expressionId, refs),
      type: expectedType,
      operator,
      operands: operands as RelTypedExpression[],
    };
  }
  if (structured.kind === "CASE") {
    if (structured.whens.length === 0) {
      state.issues.push(projectionIssue(
        "PROJECT_CASE_EMPTY",
        "CASE requires at least one WHEN branch in the structured projection.",
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    const booleanType: ConcreteSqlType = {
      status: "CONCRETE",
      name: "BOOLEAN",
      nullable: true,
    };
    const branches = structured.whens.map((branch, ordinal) => {
      const selector = projectStructuredExpression(
        state,
        relation,
        inputNode,
        branch.when,
        `${expressionId}:when:${ordinal}`,
        refs,
        booleanType,
      );
      const result = projectStructuredExpression(
        state,
        relation,
        inputNode,
        branch.then,
        `${expressionId}:then:${ordinal}`,
        refs,
        expectedType,
      );
      return selector && result
        ? { ordinal, selector, result }
        : null;
    });
    const elseResult = structured.elseExpr
      ? projectStructuredExpression(
          state,
          relation,
          inputNode,
          structured.elseExpr,
          `${expressionId}:else`,
          refs,
          expectedType,
        )
      : undefined;
    if (branches.some((branch) => branch === null)) return null;
    if (structured.elseExpr && !elseResult) return null;
    return {
      kind: "CASE",
      ...expressionBase(state, relation, expressionId, refs),
      type: expectedType,
      branches: branches as {
        ordinal: number;
        selector: RelTypedExpression;
        result: RelTypedExpression;
      }[],
      ...(elseResult ? { elseResult } : {}),
    };
  }
  if (structured.kind === "UNARY") {
    const normalized = structured.op.trim().toUpperCase();
    const operator = normalized === "NOT"
      ? "NOT"
      : normalized === "+" || normalized === "PLUS"
        ? "UNARY_PLUS"
        : normalized === "-" || normalized === "MINUS"
          ? "UNARY_MINUS"
          : null;
    if (!operator) {
      state.issues.push(projectionIssue(
        "PROJECT_UNARY_OPERATOR_UNSUPPORTED",
        `Unary operator ${structured.op} is outside the typed Calcite projection subset.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    const operand = projectStructuredExpression(
      state,
      relation,
      inputNode,
      structured.operand,
      `${expressionId}:operand`,
      refs,
      operator === "NOT"
        ? { status: "CONCRETE", name: "BOOLEAN", nullable: true }
        : expectedType,
    );
    if (!operand) return null;
    return {
      kind: "CALL",
      ...expressionBase(state, relation, expressionId, refs),
      type: expectedType,
      operator,
      operands: [operand],
    };
  }
  if (structured.kind === "CAST") {
    const operand = projectStructuredExpression(
      state,
      relation,
      inputNode,
      structured.expr,
      `${expressionId}:cast-operand`,
      refs,
      expectedType,
    );
    if (!operand) return null;
    return {
      kind: "CAST",
      ...expressionBase(state, relation, expressionId, refs),
      type: expectedType,
      operand,
    };
  }
  if (structured.kind === "PREDICATE") {
    const normalized = structured.op.trim().toUpperCase();
    const operator = normalized === "ILIKE" ? "LIKE" : normalized;
    if (!["IN", "BETWEEN", "LIKE", "IS_NULL", "IS_NOT_NULL"].includes(operator)) {
      state.issues.push(projectionIssue(
        "PROJECT_PREDICATE_OPERATOR_UNSUPPORTED",
        `Predicate operator ${structured.op} is outside the typed Calcite projection subset.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    const booleanType: ConcreteSqlType = {
      status: "CONCRETE",
      name: "BOOLEAN",
      nullable: true,
    };
    const operand = projectStructuredExpression(
      state,
      relation,
      inputNode,
      structured.operand,
      `${expressionId}:predicate-operand`,
      refs,
      expectedType,
    );
    const args = structured.args.map((arg, ordinal) =>
      projectStructuredExpression(
        state,
        relation,
        inputNode,
        arg,
        `${expressionId}:predicate-arg:${ordinal}`,
        refs,
        operand && operand.kind !== "UNSUPPORTED" ? operand.type : expectedType,
      ),
    );
    if (!operand || args.some((arg) => arg === null)) return null;
    const call: RelTypedExpression = {
      kind: "CALL",
      ...expressionBase(state, relation, expressionId, refs),
      type: booleanType,
      operator,
      operands: [operand, ...args as RelTypedExpression[]],
    };
    return structured.negated
      ? {
          kind: "CALL",
          ...expressionBase(state, relation, `${expressionId}:not`, refs),
          type: booleanType,
          operator: "NOT",
          operands: [call],
        }
      : call;
  }
  if (structured.kind === "BINARY") {
    const rawOperator = structured.op.trim();
    const operator = rawOperator === "||"
      ? "CONCAT"
      : rawOperator === "="
        ? "EQ"
        : rawOperator === "<>" || rawOperator === "!="
          ? "NE"
          : rawOperator === "<"
            ? "LT"
            : rawOperator === "<="
              ? "LTE"
              : rawOperator === ">"
                ? "GT"
                : rawOperator === ">="
                  ? "GTE"
                  : rawOperator === "+"
                    ? "PLUS"
                    : rawOperator === "-"
                      ? "MINUS"
                      : rawOperator === "*"
                        ? "MULTIPLY"
                        : rawOperator === "/"
                          ? "DIVIDE"
                          : rawOperator.toUpperCase();
    if (!["CONCAT", "EQ", "NE", "LT", "LTE", "GT", "GTE", "PLUS", "MINUS", "MULTIPLY", "DIVIDE", "AND", "OR"].includes(operator)) {
      state.issues.push(projectionIssue(
        "PROJECT_BINARY_OPERATOR_UNSUPPORTED",
        `Binary operator ${structured.op} is outside the typed Calcite projection subset.`,
        relation.id,
        refs,
        expressionId,
      ));
      return null;
    }
    const booleanOperator = operator === "AND" || operator === "OR";
    const left = projectStructuredExpression(
      state,
      relation,
      inputNode,
      structured.left,
      `${expressionId}:left`,
      refs,
      booleanOperator
        ? { status: "CONCRETE", name: "BOOLEAN", nullable: true }
        : expectedType,
    );
    const right = projectStructuredExpression(
      state,
      relation,
      inputNode,
      structured.right,
      `${expressionId}:right`,
      refs,
      booleanOperator
        ? { status: "CONCRETE", name: "BOOLEAN", nullable: true }
        : left && left.kind !== "UNSUPPORTED" ? left.type : expectedType,
    );
    if (!left || !right) return null;
    return {
      kind: "CALL",
      ...expressionBase(state, relation, expressionId, refs),
      type: expectedType,
      operator,
      operands: [left, right],
    };
  }
  state.issues.push(projectionIssue(
    "PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED",
    `Structured expression kind ${structured.kind} is not in the typed Calcite projection subset.`,
    relation.id,
    refs,
    expressionId,
  ));
  return null;
}

function projectProjectExpression(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "project" }>,
  inputNode: PlanFactsRelNode,
  expression: ExprSpec,
  ordinal: number,
  outputType: ConcreteSqlType,
): RelTypedExpression | null {
  const evidenceKey = `${relation.id}:project:${ordinal}`;
  const refs = requiredEvidence(state, relation.id, evidenceKey);
  if (!refs) return null;
  const id = `${relation.id}:project:${ordinal}`;
  const inputs = expression.input_columns ?? [];
  if (expression.expr_kind === "column" && inputs.length === 1) {
    const input = inputs[0]!;
    const field = nodeOutputByName(state, inputNode, input.name, input.qualifier, relation.id, refs);
    if (!field) return null;
    if (!sameConcreteType(field.type, outputType)) {
      state.issues.push(projectionIssue(
        "PROJECT_OUTPUT_TYPE_MISMATCH",
        `Project output ${ordinal} type does not match its direct input field.`,
        relation.id,
        refs,
        id,
      ));
      return null;
    }
    return {
      kind: "FIELD_REF",
      ...expressionBase(state, relation, id, refs, {
        ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      }),
      type: field.type,
      inputNodeId: inputNode.nodeId,
      inputOrdinal: field.ordinal,
      ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      ...(field.sourceBinding ? { sourceBinding: field.sourceBinding } : {}),
    };
  }
  if (expression.expr_kind === "literal" && inputs.length === 0) {
    const literals = expression.expression_facts?.literals ?? [];
    if (literals.length === 1) {
      const value = parseLiteral(literals[0]!, outputType);
      if (value !== undefined)
        return {
          kind: "LITERAL",
          ...expressionBase(state, relation, id, refs),
          type: outputType,
          value,
        };
      }
  }
  if (expression.structured_expression) {
    return projectStructuredExpression(
      state,
      relation,
      inputNode,
      expression.structured_expression,
      id,
      refs,
      outputType,
    );
  }
  state.issues.push(projectionIssue(
    "PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED",
    `Expression ${ordinal} lacks an exact structured operand tree; SQL text fallback is forbidden.`,
    relation.id,
    refs,
    id,
  ));
  return null;
}

function aggregateFunctionName(expression: ExprSpec): string | null {
  const functions = expression.expression_facts?.functions ?? [];
  if (functions.length !== 1 || !functions[0]) return null;
  const name = functions[0].trim().toUpperCase();
  return name || null;
}

function projectAggregateMeasure(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "aggregate" }>,
  inputNode: PlanFactsRelNode,
  expression: ExprSpec,
  ordinal: number,
  outputType: ConcreteSqlType,
): RelTypedExpression | null {
  const evidenceKey = `${relation.id}:aggregate:${ordinal}`;
  const refs = requiredEvidence(state, relation.id, evidenceKey);
  if (!refs) return null;
  if (!expression.aggregate) {
    state.issues.push(projectionIssue(
      "AGGREGATE_MEASURE_NOT_MARKED",
      `Aggregate measure ${ordinal} is not marked aggregate=true.`,
      relation.id,
      refs,
      `${relation.id}:aggregate:${ordinal}`,
    ));
    return null;
  }
  const operator = aggregateFunctionName(expression);
  if (!operator || !["COUNT", "SUM", "SUM0", "AVG", "MIN", "MAX"].includes(operator)) {
    state.issues.push(projectionIssue(
      "AGGREGATE_FUNCTION_UNSUPPORTED",
      `Aggregate function for measure ${ordinal} is not a supported structured function.`,
      relation.id,
      refs,
      `${relation.id}:aggregate:${ordinal}`,
    ));
    return null;
  }
  const inputs = expression.input_columns ?? [];
  if (operator === "COUNT" && inputs.length > 1) {
    state.issues.push(projectionIssue(
      "AGGREGATE_ARGUMENT_ARITY_INVALID",
      "COUNT accepts at most one structured input column in the core projection.",
      relation.id,
      refs,
      `${relation.id}:aggregate:${ordinal}`,
    ));
    return null;
  }
  const operands = inputs.map((input) => {
    const field = nodeOutputByName(state, inputNode, input.name, input.qualifier, relation.id, refs);
    if (!field) return null;
    return {
      kind: "FIELD_REF" as const,
      ...expressionBase(state, relation, `${relation.id}:aggregate:${ordinal}:${input.name}`, refs, {
        ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      }),
      type: field.type,
      inputNodeId: inputNode.nodeId,
      inputOrdinal: field.ordinal,
      ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      ...(field.sourceBinding ? { sourceBinding: field.sourceBinding } : {}),
    };
  });
  if (operands.some((operand) => operand === null)) return null;
  return {
    kind: "CALL",
    ...expressionBase(state, relation, `${relation.id}:aggregate:${ordinal}`, refs),
    type: outputType,
    operator,
    operands: operands as RelTypedExpression[],
  };
}

function projectAggregateGroupKey(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "aggregate" }>,
  inputNode: PlanFactsRelNode,
  column: ColumnRef,
  ordinal: number,
): RelTypedExpression | null {
  const refs = requiredEvidence(state, relation.id);
  if (!refs) return null;
  const field = nodeOutputByName(state, inputNode, column.name, column.qualifier, relation.id, refs);
  if (!field) return null;
  return {
    kind: "FIELD_REF",
    ...expressionBase(state, relation, `${relation.id}:group:${ordinal}`, refs, {
      ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
    }),
    type: field.type,
    inputNodeId: inputNode.nodeId,
    inputOrdinal: field.ordinal,
    ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
    ...(field.sourceBinding ? { sourceBinding: field.sourceBinding } : {}),
  };
}

function joinInputField(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "join" }>,
  name: string,
  qualifier: string | undefined,
  evidenceRefs: readonly string[],
): { readonly node: PlanFactsRelNode; readonly field: RelOutputField } | null {
  const inputs = [state.nodes.get(relation.left), state.nodes.get(relation.right)]
    .filter((node): node is PlanFactsRelNode => node !== undefined);
  const matches = inputs.flatMap((node) =>
    node.outputFields
      .filter((field) => field.name.toLowerCase() === name.toLowerCase())
      .filter((field) => qualifier === undefined ||
        field.sourceBinding?.toLowerCase() === qualifier.toLowerCase())
      .map((field) => ({ node, field })),
  );
  if (matches.length === 1) return matches[0]!;
  state.issues.push(projectionIssue(
    matches.length === 0 ? "INPUT_FIELD_MISSING" : "INPUT_FIELD_AMBIGUOUS",
    `Join input field ${qualifier ? `${qualifier}.` : ""}${name} is not uniquely addressable on ${relation.id}.`,
    relation.id,
    evidenceRefs,
  ));
  return null;
}

function predicateOperand(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "filter" | "join" }>,
  inputNode: PlanFactsRelNode,
  operand: PredicateOperand,
  expressionId: string,
  refs: readonly string[],
  expectedType?: ConcreteSqlType,
): RelTypedExpression | null {
  if (operand.kind === "COLUMN") {
    const located = relation.type === "join"
      ? joinInputField(
          state,
          relation,
          operand.column.name,
          operand.column.qualifier,
          refs,
        )
      : (() => {
          const field = nodeOutputByName(
            state,
            inputNode,
            operand.column.name,
            operand.column.qualifier,
            relation.id,
            refs,
          );
          return field ? { node: inputNode, field } : null;
        })();
    if (!located) return null;
    const { node, field } = located;
    return {
      kind: "FIELD_REF",
      ...expressionBase(state, relation, expressionId, refs, {
        ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      }),
      type: field.type,
      inputNodeId: node.nodeId,
      inputOrdinal: field.ordinal,
      ...(field.nativeFieldId ? { nativeFieldId: field.nativeFieldId } : {}),
      ...(field.sourceBinding ? { sourceBinding: field.sourceBinding } : {}),
    };
  }
  if (operand.kind === "LITERAL" && expectedType) {
    const value = parseLiteral(operand.observedValue, expectedType);
    if (value !== undefined)
      return { kind: "LITERAL", ...expressionBase(state, relation, expressionId, refs), type: { ...expectedType, nullable: value === null }, value };
  }
  if (operand.kind === "OTHER" && operand.structured_expression) {
    return projectStructuredExpression(
      state,
      relation,
      inputNode,
      operand.structured_expression,
      expressionId,
      refs,
      expectedType ?? inferredLiteralType(""),
    );
  }
  state.issues.push(projectionIssue("PREDICATE_OPERAND_UNSUPPORTED", "Predicate operand is not structurally typed.", relation.id, refs, expressionId));
  return null;
}

function predicateExpression(
  state: ProjectionState,
  relation: Extract<PlanRelation, { type: "filter" | "join" }>,
  inputNode: PlanFactsRelNode,
  tree: PredicateTree,
  path: string,
  refs: readonly string[],
): RelTypedExpression | null {
  const booleanType: ConcreteSqlType = { status: "CONCRETE", name: "BOOLEAN", nullable: true };
  if (tree.kind === "AND" || tree.kind === "OR") {
    const operands = tree.children.map((child, index) => predicateExpression(state, relation, inputNode, child, `${path}.${index}`, refs));
    if (operands.some((operand) => operand === null)) return null;
    return { kind: "CALL", ...expressionBase(state, relation, path, refs), type: booleanType, operator: tree.kind, operands: operands as RelTypedExpression[] };
  }
  if (tree.kind === "NOT") {
    const operand = predicateExpression(state, relation, inputNode, tree.child, `${path}.not`, refs);
    return operand ? { kind: "CALL", ...expressionBase(state, relation, path, refs), type: booleanType, operator: "NOT", operands: [operand] } : null;
  }
  if (tree.kind !== "ATOM") {
    state.issues.push(projectionIssue(
      "PREDICATE_OPERATOR_UNSUPPORTED",
      "Predicate tree node is outside the core subset.",
      relation.id,
      refs,
      path,
    ));
    return null;
  }
  if (tree.operator === "IN") {
    if (tree.operands.length < 2) {
      state.issues.push(projectionIssue("PREDICATE_OPERATOR_UNSUPPORTED", "IN requires one value and at least one candidate.", relation.id, refs, path));
      return null;
    }
    const columnOperand = tree.operands[0];
    const expectedField = columnOperand?.kind === "COLUMN"
      ? (relation.type === "join"
          ? joinInputField(state, relation, columnOperand.column.name, columnOperand.column.qualifier, refs)?.field
          : nodeOutputByName(state, inputNode, columnOperand.column.name, columnOperand.column.qualifier, relation.id, refs))
      : null;
    const operands = tree.operands.map((operand, index) => predicateOperand(state, relation, inputNode, operand, `${path}.operand.${index}`, refs, expectedField?.type));
    if (operands.some((operand) => operand === null)) return null;
    return { kind: "CALL", ...expressionBase(state, relation, path, refs), type: booleanType, operator: "IN", operands: operands as RelTypedExpression[] };
  }
  if (tree.operator === "LIKE" && tree.operands.length === 2) {
    const columnOperand = tree.operands[0];
    const expectedField = columnOperand?.kind === "COLUMN"
      ? (relation.type === "join"
          ? joinInputField(state, relation, columnOperand.column.name, columnOperand.column.qualifier, refs)?.field
          : nodeOutputByName(state, inputNode, columnOperand.column.name, columnOperand.column.qualifier, relation.id, refs))
      : null;
    const operands = tree.operands.map((operand, index) => predicateOperand(
      state,
      relation,
      inputNode,
      operand,
      `${path}.operand.${index}`,
      refs,
      expectedField?.type,
    ));
    if (operands.some((operand) => operand === null)) return null;
    return { kind: "CALL", ...expressionBase(state, relation, path, refs), type: booleanType, operator: "LIKE", operands: operands as RelTypedExpression[] };
  }

  if (tree.operator === "BETWEEN" && tree.operands.length === 3) {
    const columnOperand = tree.operands[0];
    const expectedField = columnOperand?.kind === "COLUMN"
      ? (relation.type === "join"
          ? joinInputField(state, relation, columnOperand.column.name, columnOperand.column.qualifier, refs)?.field
          : nodeOutputByName(state, inputNode, columnOperand.column.name, columnOperand.column.qualifier, relation.id, refs))
      : null;
    const operands = tree.operands.map((operand, index) => predicateOperand(
      state,
      relation,
      inputNode,
      operand,
      `${path}.operand.${index}`,
      refs,
      expectedField?.type,
    ));
    if (operands.some((operand) => operand === null)) return null;
    return {
      kind: "CALL",
      ...expressionBase(state, relation, path, refs),
      type: booleanType,
      operator: "BETWEEN",
      operands: operands as RelTypedExpression[],
    };
  }

	if (!["EQ", "NE", "LT", "LTE", "GT", "GTE"].includes(tree.operator) || tree.operands.length !== 2) {
    state.issues.push(projectionIssue("PREDICATE_OPERATOR_UNSUPPORTED", `Predicate operator ${tree.operator} is outside the core subset.`, relation.id, refs, path));
    return null;
  }
  const columnOperand = tree.operands.find((operand) => operand.kind === "COLUMN");
  const expectedField = columnOperand?.kind === "COLUMN"
    ? (relation.type === "join"
        ? joinInputField(state, relation, columnOperand.column.name, columnOperand.column.qualifier, refs)?.field
        : nodeOutputByName(state, inputNode, columnOperand.column.name, columnOperand.column.qualifier, relation.id, refs))
    : null;
  const operands = tree.operands.map((operand, index) => predicateOperand(state, relation, inputNode, operand, `${path}.operand.${index}`, refs, expectedField?.type));
  if (operands.some((operand) => operand === null)) return null;
  return { kind: "CALL", ...expressionBase(state, relation, path, refs), type: booleanType, operator: tree.operator, operands: operands as RelTypedExpression[] };
}

function derivedSourceKind(
  value: "cte" | "subquery" | "relation" | "graphtable" | "pivot",
): "CTE" | "SUBQUERY" | "RELATION" | "GRAPHTABLE" | "PIVOT" {
  return value.toUpperCase() as "CTE" | "SUBQUERY" | "RELATION" | "GRAPHTABLE" | "PIVOT";
}

function joinType(value: string): "INNER" | "LEFT" | "RIGHT" | "FULL" | "SEMI" | "ANTI" | "CROSS" | null {
  const normalized = value.trim().toUpperCase();
  return ["INNER", "LEFT", "RIGHT", "FULL", "SEMI", "ANTI", "CROSS"].includes(normalized)
    ? normalized as "INNER" | "LEFT" | "RIGHT" | "FULL" | "SEMI" | "ANTI" | "CROSS"
    : null;
}

function projectNode(state: ProjectionState, relationId: string): PlanFactsRelNode | null {
  const cached = state.nodes.get(relationId);
  if (cached) return cached;
  const relation = state.relations.get(relationId);
  if (!relation) {
    state.issues.push(projectionIssue("RELATION_INPUT_DANGLING", `Missing relation ${relationId}.`, relationId, []));
    return null;
  }
  if (!state.active.add(relationId)) {
    state.issues.push(projectionIssue("RELATION_GRAPH_CYCLE", `Cycle at relation ${relationId}.`, relationId, []));
    return null;
  }
  try {
    const relationRefs = requiredEvidence(state, relation.id);
    if (!relationRefs) return null;
    const nodeMappingId = addMapping(state, relation, "relation", relationRefs, relation.type === "read" ? { nativeRelationOccurrenceId: relation.read_occurrence_id } : {});
    if (relation.type === "read") {
      if (relation.is_cte) {
        const bindings = (state.input.planFacts.scope_bindings ?? []).filter(
          (binding) => binding.relation_id === relation.id,
        );
        if (bindings.length !== 1 || !bindings[0]!.target_relation_id) {
          state.issues.push(projectionIssue(
            bindings.length > 1 ? "DERIVED_SCOPE_BINDING_AMBIGUOUS" : "DERIVED_SCOPE_TARGET_MISSING",
            `CTE read ${relation.id} requires one exact scope binding target.`,
            relation.id,
            relationRefs,
          ));
          return null;
        }
        const sourceNode = projectNode(state, bindings[0]!.target_relation_id);
        if (!sourceNode) return null;
        const outputFields = sourceNode.outputFields.map((field, ordinal) =>
          outputField(
            state,
            relation,
            ordinal,
            field.name,
            field.type,
            [...relationRefs, ...field.evidenceRefs],
            field.nativeFieldId,
            relation.binding,
          ),
        );
  const node: PlanFactsRelNode = {
          kind: "DERIVED",
          nodeId: relation.id,
          nativeRelationId: relation.id,
          ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}),
          mappingId: nodeMappingId,
          evidenceRefs: relationRefs,
          sourceSpan: relation.span,
          sourceNodeId: sourceNode.nodeId,
          sourceKind: derivedSourceKind(
            bindings[0]!.source_kind,
          ),
          outputFields,
        };
        state.nodes.set(relation.id, node);
        return node;
      }
      const resolved = schemaTypesForRead(state, relation);
      if (!resolved) return null;
      const outputFields = resolved.facts.map((fact) => outputField(
        state,
        relation,
        fact.column.ordinal,
        fact.column.name,
        fact.type,
        fact.evidenceRefs,
        physicalTableFieldId(resolved.physicalTableIdentity, fact.column.name)
          ?? `${identityParts(fact.table).join(".")}.${fact.column.name}`,
        relation.binding,
      ));
      const node: PlanFactsRelNode = { kind: "READ", nodeId: relation.id, nativeRelationId: relation.id, nativeRelationOccurrenceId: relation.read_occurrence_id, ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}), mappingId: nodeMappingId, evidenceRefs: relationRefs, sourceSpan: relation.span, table: resolved.identity, outputFields };
      state.nodes.set(relation.id, node);
      return node;
    }
    if (relation.type !== "project" && relation.type !== "filter" && relation.type !== "join" && relation.type !== "aggregate" && relation.type !== "setop") {
      state.issues.push(projectionIssue("RELATION_KIND_UNSUPPORTED", `Relation ${relation.type} is outside the core projection batch.`, relation.id, relationRefs));
      return null;
    }
    if (relation.type === "join") {
      const leftNode = projectNode(state, relation.left);
      const rightNode = projectNode(state, relation.right);
      const type = joinType(relation.join_type);
      if (!leftNode || !rightNode || !type) {
        if (!type) state.issues.push(projectionIssue("JOIN_TYPE_UNSUPPORTED", `Join type ${relation.join_type} is outside the core subset.`, relation.id, relationRefs));
        return null;
      }
      let condition: RelTypedExpression | undefined;
      if (relation.condition_tree) {
        const parsedCondition = predicateExpression(state, relation, {
          kind: "UNSUPPORTED",
          nodeId: relation.id,
          nativeRelationId: relation.id,
          mappingId: nodeMappingId,
          evidenceRefs: relationRefs,
          outputFields: [
            ...leftNode.outputFields,
            ...rightNode.outputFields,
          ],
          reasonCode: "JOIN_INPUT_CONTEXT",
          message: "Temporary join input context",
          inputNodeIds: [leftNode.nodeId, rightNode.nodeId],
        }, relation.condition_tree, `${relation.id}:condition`, relationRefs);
        condition = parsedCondition ?? undefined;
      } else if (type !== "CROSS") {
        state.issues.push(projectionIssue("JOIN_CONDITION_TREE_MISSING", "Non-cross joins require condition_tree; SQL text fallback is forbidden.", relation.id, relationRefs));
        return null;
      }
      if (relation.condition_tree && !condition) return null;
      // SEMI/ANTI joins only expose the left row type in Calcite.  The right
      // side remains available in the condition context for predicate lineage.
      const joinOutputFields = type === "SEMI" || type === "ANTI"
        ? leftNode.outputFields
        : [...leftNode.outputFields, ...rightNode.outputFields];
      const outputFields = joinOutputFields.map((field, ordinal) =>
        outputField(
          state,
          relation,
          ordinal,
          field.name,
          field.type,
          [...relationRefs, ...field.evidenceRefs],
          field.nativeFieldId,
          field.sourceBinding,
        ),
      );
      const node: PlanFactsRelNode = {
        kind: "JOIN",
        nodeId: relation.id,
        nativeRelationId: relation.id,
        ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}),
        mappingId: nodeMappingId,
        evidenceRefs: relationRefs,
        sourceSpan: relation.span,
        leftNodeId: leftNode.nodeId,
        rightNodeId: rightNode.nodeId,
        joinType: type,
        ...(condition ? { condition } : {}),
        outputFields,
      };
      state.nodes.set(relation.id, node);
      return node;
    }
    if (!relation.source && relation.type !== "setop") {
      state.issues.push(projectionIssue("RELATION_INPUT_MISSING", "Core relation has no source relation.", relation.id, relationRefs));
      return null;
    }
    // Set operations do not have a `source`; materialize their first branch
    // here so the shared input guard remains strict, then resolve all exact
    // branches in the dedicated set-op block below.
    const inputNode = relation.type === "setop"
      ? relation.branches.length > 0 ? projectNode(state, relation.branches[0]!) : null
      : projectNode(state, relation.source!);
    if (!inputNode) return null;
    if (relation.type === "filter") {
      const clause = relation.clause?.toUpperCase();
      if (clause !== "WHERE" && clause !== "HAVING" && clause !== "QUALIFY") {
        state.issues.push(projectionIssue(
          "FILTER_CLAUSE_MISSING",
          "Filter clause role must be explicit; SQL text fallback is forbidden.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      const refs = requiredEvidence(state, relation.id, `${relation.id}:predicate`);
      if (!refs || !relation.predicate_tree) {
        if (!relation.predicate_tree) state.issues.push(projectionIssue("PREDICATE_TREE_MISSING", "Filter predicate_tree is required; predicate text fallback is forbidden.", relation.id, refs ?? relationRefs));
        return null;
      }
      const predicate = predicateExpression(state, relation, inputNode, relation.predicate_tree, `${relation.id}:predicate`, refs);
      if (!predicate) return null;
      const outputFields = inputNode.outputFields.map((field, ordinal) => outputField(state, relation, ordinal, field.name, field.type, [...relationRefs, ...field.evidenceRefs], field.nativeFieldId, field.sourceBinding));
      const node: PlanFactsRelNode = { kind: "FILTER", nodeId: relation.id, nativeRelationId: relation.id, ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}), mappingId: nodeMappingId, evidenceRefs: relationRefs, sourceSpan: relation.span, inputNodeId: inputNode.nodeId, clause, predicate, outputFields };
      state.nodes.set(relation.id, node);
      return node;
    }
    if (relation.type === "aggregate") {
      const groupKeys = (relation.group_by ?? []).map((column, ordinal) =>
        projectAggregateGroupKey(state, relation, inputNode, column, ordinal),
      );
      if (groupKeys.some((key) => key === null)) return null;
      const measures = (relation.measures ?? []).map((measure, ordinal) => {
        const binding = state.outputTypes.get(outputTypeKey(relation.id, (relation.group_by ?? []).length + ordinal));
        if (!binding) {
          state.issues.push(projectionIssue(
            "OUTPUT_TYPE_MISSING",
            `Aggregate measure ${ordinal} requires an explicit concrete type.`,
            relation.id,
            relationRefs,
          ));
          return null;
        }
        return projectAggregateMeasure(state, relation, inputNode, measure, ordinal, binding.type);
      });
      if (measures.some((measure) => measure === null)) return null;
      const outputNames = relation.output_columns ?? [
        ...(relation.group_by ?? []).map((column) => column.name),
        ...(relation.measures ?? []).map((measure) => measure.output),
      ];
      const expressions = [
        ...(groupKeys as RelTypedExpression[]),
        ...(measures as RelTypedExpression[]),
      ];
      if (outputNames.length !== expressions.length) {
        state.issues.push(projectionIssue(
          "AGGREGATE_OUTPUT_ARITY_MISMATCH",
          "Aggregate output columns must align with group keys followed by measures.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      if (expressions.some((expression) => !("type" in expression))) {
        state.issues.push(projectionIssue(
          "OUTPUT_TYPE_MISSING",
          "Every aggregate output expression requires a concrete type.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      const typedExpressions = expressions as Exclude<RelTypedExpression, { readonly kind: "UNSUPPORTED" }>[];
      const outputFields = outputNames.map((name, ordinal) => {
        const binding = state.outputTypes.get(outputTypeKey(relation.id, ordinal));
        const expression = typedExpressions[ordinal]!;
        const fieldType = binding?.type ?? expression.type;
        const refs = binding?.evidenceRefs ?? relationRefs;
        return outputField(state, relation, ordinal, name, fieldType, [...refs, ...expression.evidenceRefs], binding?.nativeFieldId);
      });
      const node: PlanFactsRelNode = {
        kind: "AGGREGATE",
        nodeId: relation.id,
        nativeRelationId: relation.id,
        ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}),
        mappingId: nodeMappingId,
        evidenceRefs: relationRefs,
        sourceSpan: relation.span,
        inputNodeId: inputNode.nodeId,
        groupKeys: groupKeys as RelTypedExpression[],
        measures: measures as RelTypedExpression[],
        outputFields,
      };
      state.nodes.set(relation.id, node);
      return node;
    }
    if (relation.type === "setop") {
      const branches = relation.branches ?? [];
      if (branches.length < 2) {
        state.issues.push(projectionIssue(
          "SETOP_BRANCHES_INVALID",
          "Set operations require at least two exact input branches.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      const branchNodes = branches.map((branch) => projectNode(state, branch));
      if (branchNodes.some((branch) => branch === null)) return null;
      const resolvedBranches = branchNodes as PlanFactsRelNode[];
      const firstBranch = resolvedBranches[0]!;
      if (resolvedBranches.some((branch) => branch.outputFields.length !== firstBranch.outputFields.length)) {
        state.issues.push(projectionIssue(
          "SETOP_ARITY_MISMATCH",
          "Set operation branches must expose the same number of fields.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      for (let ordinal = 0; ordinal < firstBranch.outputFields.length; ordinal += 1) {
        const expected = firstBranch.outputFields[ordinal]!.type;
        if (resolvedBranches.some((branch) => !sameConcreteType(branch.outputFields[ordinal]!.type, expected))) {
          state.issues.push(projectionIssue(
            "SETOP_FIELD_TYPE_MISMATCH",
            `Set operation field ${ordinal} does not have one exact compatible type across branches.`,
            relation.id,
            relationRefs,
          ));
          return null;
        }
      }
      const operation = relation.setop.trim().toUpperCase();
      if (!["UNION", "INTERSECT", "EXCEPT"].includes(operation)) {
        state.issues.push(projectionIssue(
          "SETOP_OPERATOR_UNSUPPORTED",
          `Set operation ${relation.setop} is outside the core subset.`,
          relation.id,
          relationRefs,
        ));
        return null;
      }
      const outputNames = relation.output_columns ?? firstBranch.outputFields.map((field) => field.name);
      if (outputNames.length !== firstBranch.outputFields.length) {
        state.issues.push(projectionIssue(
          "SETOP_OUTPUT_ARITY_MISMATCH",
          "Set operation output columns must match branch arity.",
          relation.id,
          relationRefs,
        ));
        return null;
      }
      const outputFields = outputNames.map((name, ordinal) => {
        const sourceField = firstBranch.outputFields[ordinal]!;
        const branchEvidenceRefs = resolvedBranches.flatMap((branch) => branch.evidenceRefs);
        return outputField(
          state,
          relation,
          ordinal,
          name,
          sourceField.type,
          [...relationRefs, ...branchEvidenceRefs, ...sourceField.evidenceRefs],
          sourceField.nativeFieldId,
          sourceField.sourceBinding,
        );
      });
      const node: PlanFactsRelNode = {
        kind: "SETOP",
        nodeId: relation.id,
        nativeRelationId: relation.id,
        ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}),
        mappingId: nodeMappingId,
        evidenceRefs: relationRefs,
        sourceSpan: relation.span,
        inputNodeIds: resolvedBranches.map((branch) => branch.nodeId),
        operation: operation as "UNION" | "INTERSECT" | "EXCEPT",
        all: relation.all === true,
        byName: relation.by_name === true,
        outputFields,
      };
      state.nodes.set(relation.id, node);
      return node;
    }
    const outputFields: RelOutputField[] = [];
    const expressions: RelTypedExpression[] = [];
    const scopeBinding = derivedScopeBinding(relation.scope_id);
    for (const [ordinal, expression] of relation.expressions.entries()) {
      const binding = state.outputTypes.get(outputTypeKey(relation.id, ordinal));
      if (!binding) {
        state.issues.push(projectionIssue("OUTPUT_TYPE_MISSING", `Project output ${ordinal} requires an explicit concrete type.`, relation.id, relationRefs));
        return null;
      }
      const projected = projectProjectExpression(state, relation, inputNode, expression, ordinal, binding.type);
      if (!projected) return null;
      expressions.push(projected);
      outputFields.push(outputField(
        state,
        relation,
        ordinal,
        expression.output,
        binding.type,
        binding.evidenceRefs,
        binding.nativeFieldId,
        scopeBinding ?? (projected.kind === "FIELD_REF" ? projected.sourceBinding : undefined),
      ));
    }
    const node: PlanFactsRelNode = { kind: "PROJECT", nodeId: relation.id, nativeRelationId: relation.id, ...(relation.scope_id ? { nativeScopeId: relation.scope_id } : {}), mappingId: nodeMappingId, evidenceRefs: relationRefs, sourceSpan: relation.span, inputNodeId: inputNode.nodeId, expressions, outputFields };
    state.nodes.set(relation.id, node);
    return node;
  } finally {
    state.active.delete(relationId);
  }
}

export function projectPlanFactsCore(
  input: PlanFactsCoreProjectionInput,
): PlanFactsCoreProjectionResult {
  const state: ProjectionState = {
    input,
    relations: new Map(input.planFacts.relations.map((relation) => [relation.id, relation])),
    nodes: new Map(),
    mappings: new Map(),
    active: new Set(),
    issues: [],
    outputTypes: new Map((input.outputTypes ?? []).map((binding) => [outputTypeKey(binding.relationId, binding.ordinal), binding])),
  };
  const roots = input.planFacts.roots.flatMap((root) => projectNode(state, root) ? [root] : []);
  const graph: PlanFactsRelGraph = {
    graphVersion: PLAN_FACTS_REL_GRAPH_VERSION,
    taskId: input.taskId,
    statementId: input.statementId,
    nodes: [...state.nodes.values()],
    rootNodeIds: roots,
  };
  const contract = validatePlanFactsRelGraph(graph);
  state.issues.push(...contract.issues.map((issue) => projectionIssue(issue.code, issue.message, issue.path, [])));
  const status = state.issues.length === 0 && roots.length === input.planFacts.roots.length
    ? "SUCCESS"
    : graph.nodes.length > 0 ? "PARTIAL" : "UNSUPPORTED";
  if (status !== "SUCCESS") return { status, graph, mappings: [...state.mappings.values()], request: null, issues: state.issues };
  const projectedSchema = input.schemaProjection.schema;
  if (!projectedSchema) {
    return {
      status: "PARTIAL",
      graph,
      mappings: [...state.mappings.values()],
      request: null,
      issues: [
        ...state.issues,
        projectionIssue(
          "SCHEMA_PROJECTION_UNAVAILABLE",
          "A successful relation graph requires a concrete Calcite schema projection.",
          "schema",
          [],
        ),
      ],
    };
  }
  const readTables = [
    ...new Map(
      graph.nodes.flatMap((node) =>
        node.kind === "READ"
          ? [[identityParts(node.table).map((part) => part.toLowerCase()).join("."), node.table] as const]
          : []),
    ).values(),
  ];
  const requestSchema = {
    tables: projectedSchema.tables.filter((table) =>
      readTables.some((readTable) => exactIdentity(readTable, table))),
  };
  if (requestSchema.tables.length !== readTables.length) {
    return {
      status: "PARTIAL",
      graph,
      mappings: [...state.mappings.values()],
      request: null,
      issues: [
        ...state.issues,
        projectionIssue(
          "SCHEMA_GRAPH_TABLE_MISMATCH",
          "Every projected READ must have exactly one request-local schema table.",
          "schema",
          [],
        ),
      ],
    };
  }
  const body: Omit<PlanFactsRelRequest, "fingerprint"> = {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: "PLAN_FACTS_REL_V1",
    graphVersion: PLAN_FACTS_REL_GRAPH_VERSION,
    taskId: input.taskId,
    statementId: input.statementId,
    schema: requestSchema,
    relations: graph.nodes,
    roots: graph.rootNodeIds,
    mappings: [...state.mappings.values()],
  };
  const request: PlanFactsRelRequest = { ...body, fingerprint: requestFingerprint(body) };
  const protocolValidation = validateDifferentialRequest(request);
  if (!protocolValidation.valid) {
    return {
      status: "PARTIAL",
      graph,
      mappings: request.mappings,
      request: null,
      issues: [...state.issues, ...protocolValidation.issues.map((issue) => projectionIssue(issue.code, issue.message, issue.path ?? "protocol", []))],
    };
  }
  return { status: "SUCCESS", graph, mappings: request.mappings, request, issues: [] };
}

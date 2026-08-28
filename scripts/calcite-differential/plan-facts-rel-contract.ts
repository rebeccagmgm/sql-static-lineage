export const PLAN_FACTS_REL_GRAPH_VERSION = 1 as const;

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
  /** Syntactic binding preserved for qualified JOIN/self-join references. */
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

/** A logical CTE/derived relation boundary backed by a child Plan Facts root. */
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

export interface PlanFactsRelContractIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface PlanFactsRelContractValidation {
  readonly valid: boolean;
  readonly issues: readonly PlanFactsRelContractIssue[];
}

function concreteTypeIssues(
  type: ConcreteSqlType,
  path: string,
): PlanFactsRelContractIssue[] {
  const issues: PlanFactsRelContractIssue[] = [];
  if (type.status !== "CONCRETE") {
    issues.push({
      code: "TYPE_STATUS_INVALID",
      message: "A Calcite-bound SQL type must declare status=CONCRETE.",
      path: `${path}.status`,
    });
  }
  const normalized = type.name.trim().toUpperCase();
  if (!normalized || normalized === "ANY" || normalized === "UNKNOWN") {
    issues.push({
      code: "TYPE_NOT_CONCRETE",
      message: "A Calcite-bound field or expression requires a concrete SQL type.",
      path: `${path}.name`,
    });
  }
  for (const [name, value] of [
    ["precision", type.precision],
    ["scale", type.scale],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      issues.push({
        code: "TYPE_PARAMETER_INVALID",
        message: `${name} must be a non-negative safe integer.`,
        path: `${path}.${name}`,
      });
    }
  }
  return issues;
}

function evidenceIssues(
  value: RelEvidenceIdentity,
  path: string,
): PlanFactsRelContractIssue[] {
  const issues: PlanFactsRelContractIssue[] = [];
  if (!value.mappingId) {
    issues.push({
      code: "MAPPING_ID_MISSING",
      message: "Every projected semantic object requires a mapping id.",
      path: `${path}.mappingId`,
    });
  }
  if (value.evidenceRefs.length === 0 || value.evidenceRefs.some((ref) => !ref)) {
    issues.push({
      code: "EVIDENCE_REFS_MISSING",
      message: "Every projected semantic object requires canonical evidence refs.",
      path: `${path}.evidenceRefs`,
    });
  }
  if (
    value.sourceSpan &&
    (value.sourceSpan.start < 0 || value.sourceSpan.end < value.sourceSpan.start)
  ) {
    issues.push({
      code: "SOURCE_SPAN_INVALID",
      message: "Source span must be ordered and non-negative.",
      path: `${path}.sourceSpan`,
    });
  }
  return issues;
}

function expressionIssues(
  expression: RelTypedExpression,
  path: string,
): PlanFactsRelContractIssue[] {
  const issues = evidenceIssues(expression, path);
  if (
    ![
      "FIELD_REF",
      "LITERAL",
      "CALL",
      "CAST",
      "CASE",
      "UNSUPPORTED",
    ].includes(expression.kind)
  ) {
    issues.push({
      code: "EXPRESSION_KIND_INVALID",
      message: `Unknown projected expression kind ${String(expression.kind)}.`,
      path: `${path}.kind`,
    });
    return issues;
  }
  if (!expression.expressionId) {
    issues.push({
      code: "EXPRESSION_ID_MISSING",
      message: "Projected expressions require a stable expression id.",
      path: `${path}.expressionId`,
    });
  }
  if (expression.kind !== "UNSUPPORTED") {
    issues.push(...concreteTypeIssues(expression.type, `${path}.type`));
  }
  switch (expression.kind) {
    case "FIELD_REF":
      if (!expression.inputNodeId) {
        issues.push({
          code: "EXPRESSION_INPUT_MISSING",
          message: "Field references require an input node.",
          path: `${path}.inputNodeId`,
        });
      }
      if (!Number.isSafeInteger(expression.inputOrdinal) || expression.inputOrdinal < 0) {
        issues.push({
          code: "FIELD_ORDINAL_INVALID",
          message: "Field reference ordinal must be a non-negative safe integer.",
          path: `${path}.inputOrdinal`,
        });
      }
      break;
    case "CALL":
      expression.operands.forEach((operand, index) =>
        issues.push(...expressionIssues(operand, `${path}.operands[${index}]`)),
      );
      break;
    case "CAST":
      issues.push(...expressionIssues(expression.operand, `${path}.operand`));
      break;
    case "CASE":
      if (expression.subject) {
        issues.push(...expressionIssues(expression.subject, `${path}.subject`));
      }
      expression.branches.forEach((branch, index) => {
        issues.push(
          ...expressionIssues(branch.selector, `${path}.branches[${index}].selector`),
          ...expressionIssues(branch.result, `${path}.branches[${index}].result`),
        );
      });
      if (expression.elseResult) {
        issues.push(...expressionIssues(expression.elseResult, `${path}.elseResult`));
      }
      break;
  }
  return issues;
}

function relationInputs(node: PlanFactsRelNode): readonly string[] {
  switch (node.kind) {
    case "READ":
      return [];
    case "DERIVED":
      return [node.sourceNodeId];
    case "JOIN":
      return [node.leftNodeId, node.rightNodeId];
    case "SETOP":
    case "UNSUPPORTED":
      return node.inputNodeIds;
    default:
      return [node.inputNodeId];
  }
}

function relationExpressions(node: PlanFactsRelNode): readonly RelTypedExpression[] {
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

function fieldReferences(
  expression: RelTypedExpression,
): readonly RelFieldRefExpression[] {
  switch (expression.kind) {
    case "FIELD_REF":
      return [expression];
    case "CALL":
      return expression.operands.flatMap(fieldReferences);
    case "CAST":
      return fieldReferences(expression.operand);
    case "CASE":
      return [
        ...(expression.subject ? fieldReferences(expression.subject) : []),
        ...expression.branches.flatMap((branch) => [
          ...fieldReferences(branch.selector),
          ...fieldReferences(branch.result),
        ]),
        ...(expression.elseResult
          ? fieldReferences(expression.elseResult)
          : []),
      ];
    default:
      return [];
  }
}

export function validatePlanFactsRelGraph(
  graph: PlanFactsRelGraph,
): PlanFactsRelContractValidation {
  const issues: PlanFactsRelContractIssue[] = [];
  if (graph.graphVersion !== PLAN_FACTS_REL_GRAPH_VERSION) {
    issues.push({
      code: "GRAPH_VERSION_MISMATCH",
      message: `graphVersion must be ${PLAN_FACTS_REL_GRAPH_VERSION}.`,
      path: "graphVersion",
    });
  }
  const nodes = new Map<string, PlanFactsRelNode>();
  graph.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    issues.push(...evidenceIssues(node, path));
    if (
      ![
        "READ",
        "DERIVED",
        "PROJECT",
        "FILTER",
        "JOIN",
        "AGGREGATE",
        "SETOP",
        "WINDOW",
        "TOP_N",
        "UNSUPPORTED",
      ].includes(node.kind)
    ) {
      issues.push({
        code: "RELATION_KIND_INVALID",
        message: `Unknown projected relation kind ${String(node.kind)}.`,
        path: `${path}.kind`,
      });
    }
    if (!node.nodeId || nodes.has(node.nodeId)) {
      issues.push({
        code: node.nodeId ? "NODE_ID_DUPLICATE" : "NODE_ID_MISSING",
        message: node.nodeId
          ? `Duplicate node id ${node.nodeId}.`
          : "Relation node id is required.",
        path: `${path}.nodeId`,
      });
    } else {
      nodes.set(node.nodeId, node);
    }
    node.outputFields.forEach((field, fieldIndex) => {
      const fieldPath = `${path}.outputFields[${fieldIndex}]`;
      issues.push(
        ...evidenceIssues(field, fieldPath),
        ...concreteTypeIssues(field.type, `${fieldPath}.type`),
      );
      if (field.ordinal !== fieldIndex) {
        issues.push({
          code: "OUTPUT_ORDINAL_NON_CONTIGUOUS",
          message: "Output ordinals must be contiguous and source ordered.",
          path: `${fieldPath}.ordinal`,
        });
      }
    });
    relationExpressions(node).forEach((expression, expressionIndex) => {
      issues.push(
        ...expressionIssues(expression, `${path}.expressions[${expressionIndex}]`),
      );
    });
  });
  graph.nodes.forEach((node, index) => {
    const directInputs = relationInputs(node);
    directInputs.forEach((inputNodeId, inputIndex) => {
      if (!nodes.has(inputNodeId)) {
        issues.push({
          code: "RELATION_INPUT_DANGLING",
          message: `Input node ${inputNodeId} does not exist.`,
          path: `nodes[${index}].inputs[${inputIndex}]`,
        });
      }
    });
    relationExpressions(node).forEach((expression, expressionIndex) => {
      fieldReferences(expression).forEach((fieldRef, fieldRefIndex) => {
        const inputPath = `nodes[${index}].expressions[${expressionIndex}].fieldRefs[${fieldRefIndex}]`;
        const inputNode = nodes.get(fieldRef.inputNodeId);
        if (!inputNode) {
          issues.push({
            code: "FIELD_REF_INPUT_DANGLING",
            message: `Field reference input node ${fieldRef.inputNodeId} does not exist.`,
            path: `${inputPath}.inputNodeId`,
          });
          return;
        }
        if (!directInputs.includes(fieldRef.inputNodeId)) {
          issues.push({
            code: "FIELD_REF_INPUT_NOT_DIRECT",
            message: `Field reference input node ${fieldRef.inputNodeId} is not a direct input of ${node.nodeId}.`,
            path: `${inputPath}.inputNodeId`,
          });
        }
        if (fieldRef.inputOrdinal >= inputNode.outputFields.length) {
          issues.push({
            code: "FIELD_REF_ORDINAL_OUT_OF_RANGE",
            message: `Field reference ordinal ${fieldRef.inputOrdinal} exceeds input ${fieldRef.inputNodeId} output width ${inputNode.outputFields.length}.`,
            path: `${inputPath}.inputOrdinal`,
          });
        }
      });
    });
  });
  const visitState = new Map<string, "VISITING" | "VISITED">();
  const visit = (nodeId: string, path: readonly string[]): void => {
    const state = visitState.get(nodeId);
    if (state === "VISITING") {
      issues.push({
        code: "RELATION_GRAPH_CYCLE",
        message: `Relation graph contains a cycle: ${[...path, nodeId].join(" -> ")}.`,
        path: `nodes.${nodeId}`,
      });
      return;
    }
    if (state === "VISITED") return;
    const node = nodes.get(nodeId);
    if (!node) return;
    visitState.set(nodeId, "VISITING");
    for (const inputNodeId of relationInputs(node)) {
      visit(inputNodeId, [...path, nodeId]);
    }
    visitState.set(nodeId, "VISITED");
  };
  for (const nodeId of nodes.keys()) visit(nodeId, []);
  graph.rootNodeIds.forEach((rootNodeId, index) => {
    if (!nodes.has(rootNodeId)) {
      issues.push({
        code: "ROOT_NODE_DANGLING",
        message: `Root node ${rootNodeId} does not exist.`,
        path: `rootNodeIds[${index}]`,
      });
    }
  });
  return { valid: issues.length === 0, issues };
}

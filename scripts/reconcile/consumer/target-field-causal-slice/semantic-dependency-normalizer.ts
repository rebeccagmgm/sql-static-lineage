import type {
  ColumnRef,
  ExprSpec,
  ExpressionRoleBinding,
  PlanFacts,
  PlanRelation,
  SourceSpan,
  WindowInputBinding,
} from "../../../plans/plan-contract.ts";
import {
  createProofRef,
  makeSemanticDependencyApplication,
  makeSemanticDependencyDefinition,
  makeSemanticDependencyEdge,
  type EffectKind,
  type LocalEdgeKind,
  type OperatorKind,
  type PathCertainty,
  type ProofRef,
  type RootDependenceKind,
  type SemanticDependencyApplication,
  type SemanticDependencyDefinition,
  type SemanticDependencyEdge,
  type SemanticSubject,
  type SubjectKind,
  type SupportStatus,
} from "./semantic-dependency-contract.ts";
import {
  lookupOperatorSupport,
  type OperatorRole,
  type OperatorSupportQuery,
  type OperatorVariant,
} from "./operator-support-matrix.ts";
import {
  physicalFieldKey,
  type PhysicalFieldIdentity,
} from "../field-lineage/field-lineage-contract.ts";

/** A resolved Plan Facts column can be upgraded to the shared physical identity. */
export interface SemanticPhysicalFieldResolver {
  readonly resolve: (
    reference: { readonly table: string; readonly column: string },
    column: ColumnRef,
  ) => PhysicalFieldIdentity | null;
}

export interface SemanticNormalizationRoot {
  /** Stable physical field id owned by the caller. */
  readonly rootTargetFieldId: string;
  /** Final relation containing the target expression. Defaults to the first plan root. */
  readonly relationId?: string;
  /** Output name used to select one expression in the target relation. */
  readonly outputName?: string;
  /** Optional richer subject; otherwise rootTargetFieldId is used as the field id. */
  readonly targetSubject?: SemanticSubject;
}

export interface SemanticDependencyNormalizerInput {
  readonly plan: PlanFacts;
  readonly roots: readonly SemanticNormalizationRoot[];
  /** Task-scopes generated semantic ids without changing Plan Facts ids. */
  readonly idNamespace?: string;
  readonly physicalFieldResolver?:
    SemanticPhysicalFieldResolver | SemanticPhysicalFieldResolver["resolve"];
  /** Accepted for callers that assemble Plan Facts beside a Machine Facts bundle. */
  readonly machineFacts?: unknown;
  /** Copied without inspection; the normalizer never rewrites legacy VALUE_FLOW edges. */
  readonly legacyEdges?: readonly unknown[];
}

export interface SemanticDependencyGap {
  readonly gapId: string;
  readonly status: "UNKNOWN" | "UNSUPPORTED";
  readonly reasonCode: string;
  readonly operatorKind: string;
  readonly operatorVariant: string;
  readonly operatorRole: string;
  readonly relationId: string | null;
  readonly rootTargetFieldId: string;
  /**
   * When a multi-source column reference contains both resolved and
   * unresolved physical candidates, scope the gap to the unresolved
   * candidate.  An unscoped gap would incorrectly poison a separately
   * proven physical dependency in the same expression.
   */
  readonly subject?: SemanticSubject;
  readonly message: string;
  readonly proofRefs: readonly ProofRef[];
  /** Negative proof must treat every normalizer gap as a hard blocker. */
  readonly blocksNegativeProof: true;
}

export interface SemanticDependencyNormalization {
  readonly definitions: readonly SemanticDependencyDefinition[];
  readonly applications: readonly SemanticDependencyApplication[];
  /** New local semantic edges. The legacy VALUE_FLOW graph is not placed here. */
  readonly edges: readonly SemanticDependencyEdge[];
  readonly semanticEdges: readonly SemanticDependencyEdge[];
  readonly gaps: readonly SemanticDependencyGap[];
  readonly legacyEdges: readonly unknown[];
}

type Query = OperatorSupportQuery;

type RelationRecord = PlanRelation & Record<string, unknown>;

const VALUE_ROOT: RootDependenceKind = "VALUE_TO_TARGET";
const CONTROL_ROOT: RootDependenceKind = "CONTROL_TO_TARGET";
const RELATION_ROOT: RootDependenceKind = "RELATION_TO_TARGET";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return text(value).toUpperCase();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  const values = new Map<string, T>();
  for (const item of items) values.set(key(item), item);
  return [...values.values()].sort((left, right) =>
    compareText(key(left), key(right)),
  );
}

function relationMap(plan: PlanFacts): ReadonlyMap<string, RelationRecord> {
  return new Map(
    plan.relations.map((relation) => [relation.id, relation as RelationRecord]),
  );
}

function childrenOf(relation: RelationRecord): readonly string[] {
  if (relation.type === "join")
    return [text(relation.left), text(relation.right)].filter(Boolean);
  if (relation.type === "setop")
    return Array.isArray(relation.branches)
      ? relation.branches.map(text).filter(Boolean)
      : [];
  const source = text(relation.source);
  return source ? [source] : [];
}

function relationReferences(
  relation: RelationRecord,
): readonly { readonly field: string; readonly id: string }[] {
  if (relation.type === "join")
    return [
      { field: "left", id: text(relation.left) },
      { field: "right", id: text(relation.right) },
    ];
  if (relation.type === "setop")
    return (Array.isArray(relation.branches) ? relation.branches : []).map(
      (id, ordinal) => ({ field: `branches[${ordinal}]`, id: text(id) }),
    );
  if (relation.type === "read") return [];
  return [{ field: "source", id: text(relation.source) }];
}

function descendantIds(
  relationId: string,
  byId: ReadonlyMap<string, RelationRecord>,
): ReadonlySet<string> {
  const seen = new Set<string>();
  const pending = [relationId];
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const relation = byId.get(current);
    if (relation) pending.push(...childrenOf(relation));
  }
  return seen;
}

function sourceSpanRef(
  kind: string,
  relationId: string,
  span: SourceSpan | null | undefined,
): ProofRef {
  const suffix = span ? `${span.start}:${span.end}` : "unknown";
  return createProofRef("SOURCE_SPAN", `plan:${kind}:${relationId}:${suffix}`);
}

function factRef(kind: string, relationId: string, detail = ""): ProofRef {
  return createProofRef(
    "CANONICAL_FACT",
    `plan:${kind}:${relationId}${detail ? `:${detail}` : ""}`,
  );
}

function relationOccurrenceId(plan: PlanFacts, relationId: string): string {
  const relation = plan.relations.find(
    (candidate) => candidate.id === relationId,
  );
  const occurrence =
    relation?.type === "read"
      ? text(relation.read_occurrence_id) ||
        text(relation.read_occurrence?.occurrence_id) ||
        relationId
      : relationId;
  return `relation:${plan.meta.statement_index}:${occurrence}`;
}

function relationSubject(plan: PlanFacts, relationId: string): SemanticSubject {
  return {
    subjectKind: "RELATION_OCCURRENCE",
    relationOccurrenceId: relationOccurrenceId(plan, relationId),
  };
}

function fieldSubject(field: PhysicalFieldIdentity): {
  readonly subject: SemanticSubject;
  readonly proofRefs: readonly ProofRef[];
} {
  return {
    subject: {
      subjectKind: "PHYSICAL_FIELD",
      physicalFieldId: physicalFieldKey(field),
    },
    proofRefs: [
      createProofRef("SCHEMA", `physical-field:${physicalFieldKey(field)}`),
    ],
  };
}

function fallbackPhysicalFieldId(table: string, column: string): string {
  return `physical:${table.toLowerCase()}:${column.toLowerCase()}`;
}

function physicalSubjects(
  column: ColumnRef,
  resolver:
    | SemanticPhysicalFieldResolver
    | SemanticPhysicalFieldResolver["resolve"]
    | undefined,
): {
  readonly subjects: readonly SemanticSubject[];
  readonly proofRefs: readonly ProofRef[];
  readonly unresolvedReferences: readonly { readonly table: string; readonly column: string }[];
} {
  const physical = column.physical;
  if (!Array.isArray(physical) || physical.length === 0)
    return { subjects: [], proofRefs: [], unresolvedReferences: [] };
  const subjects: SemanticSubject[] = [];
  const proofRefs: ProofRef[] = [];
  const unresolvedReferences: { table: string; column: string }[] = [];
  for (const reference of physical) {
    const table = text(reference.table);
    const field = text(reference.column);
    if (!table || !field) {
      unresolvedReferences.push({ table, column: field });
      continue;
    }
    const resolved =
      typeof resolver === "function"
        ? resolver({ table, column: field }, column)
        : resolver?.resolve({ table, column: field }, column);
    if (resolver && !resolved) {
      unresolvedReferences.push({ table, column: field });
      continue;
    }
    if (resolved) {
      const resolvedSubject = fieldSubject(resolved);
      subjects.push(resolvedSubject.subject);
      proofRefs.push(...resolvedSubject.proofRefs);
    } else {
      /*
       * Plan Facts' `physical` entry is already a canonical physical table and
       * column observation. The richer resolver is optional at this layer; do
       * not invent platform, datasource, or stable table ids here.
       */
      subjects.push({
        subjectKind: "PHYSICAL_FIELD",
        physicalFieldId: fallbackPhysicalFieldId(table, field),
      });
      proofRefs.push(
        createProofRef("CANONICAL_FACT", `plan:physical:${table}:${field}`),
      );
    }
  }
  return {
    subjects: unique(subjects, (subject) =>
      subject.subjectKind === "PHYSICAL_FIELD"
        ? subject.physicalFieldId
        : subject.relationOccurrenceId,
    ),
    proofRefs,
    unresolvedReferences,
  };
}

function columnsOf(value: unknown): readonly ColumnRef[] {
  return Array.isArray(value)
    ? value.filter((item): item is ColumnRef => {
        const record = asRecord(item);
        return typeof record.name === "string";
      })
    : [];
}

function expressionColumns(expression: ExprSpec): readonly ColumnRef[] {
  return columnsOf(expression.input_columns);
}

function relationColumns(relation: RelationRecord): readonly ColumnRef[] {
  return relation.type === "filter"
    ? columnsOf(relation.predicate_columns)
    : relation.type === "join"
      ? columnsOf(relation.condition_columns)
      : relation.type === "aggregate"
        ? columnsOf(relation.group_by)
        : [];
}

function expressionRoles(
  expression: ExprSpec,
): readonly ExpressionRoleBinding[] {
  return Array.isArray(expression.expression_roles)
    ? expression.expression_roles
    : [];
}

function exprKind(expression: ExprSpec): string {
  return normalized(expression.expr_kind);
}

function isFunction(expression: ExprSpec, name: string): boolean {
  const functions = expression.expression_facts?.functions ?? [];
  return functions.some((item) => normalized(item) === name);
}

function hasCountStar(expression: ExprSpec): boolean {
  if (expressionColumns(expression).length > 0) return false;
  if (isFunction(expression, "COUNT")) return true;
  // expression_facts is optional in Plan Facts.  The canonical expression
  // bytes are still authoritative for COUNT(*); do not turn its absence into
  // a silent loss of the relation-context dependency.
  return /\bCOUNT\s*\(\s*\*\s*\)/iu.test(text(expression.expr_text));
}

const MODELED_EXPRESSION_KINDS = new Set([
  "COLUMN",
  "LITERAL",
  "FUNCTION",
  "CAST",
  "BINARY",
  "UNARY",
  "PREDICATE",
  "SUBSCRIPT",
  "SUBQUERY",
]);

function expressionOperator(expression: ExprSpec): string {
  const roleOperator = expressionRoles(expression)[0]?.operator;
  if (roleOperator) return normalized(roleOperator);
  const kind = normalized(expression.expr_kind);
  if (["CASE", "IF", "COALESCE"].includes(kind)) return kind;
  const functionNames = expression.expression_facts?.functions ?? [];
  const namedFunction = functionNames.find((name) =>
    ["IF", "IIF", "COALESCE", "IFNULL", "NVL"].includes(normalized(name)),
  );
  return normalized(namedFunction);
}

function canonicalStructuredFunction(name: unknown): string {
  const functionName = normalized(name);
  if (functionName === "IIF") return "IF";
  if (["IFNULL", "NVL"].includes(functionName)) return "COALESCE";
  return functionName;
}

function query(
  operatorKind: string,
  operatorVariant: string,
  operatorRole: string,
  subjectKind: SubjectKind,
  effectKind: EffectKind,
  localEdgeKind: LocalEdgeKind,
): Query {
  return {
    operatorKind: operatorKind as OperatorKind,
    operatorVariant: operatorVariant as OperatorVariant,
    operatorRole: operatorRole as OperatorRole,
    subjectKind,
    effectKind,
    localEdgeKind,
  };
}

function relationVariant(relation: RelationRecord): string {
  if (relation.type === "filter") {
    return normalized(
      relation.clause ??
        relation.filter_clause ??
        relation.filter_kind ??
        "WHERE",
    );
  }
  if (relation.type === "join") return normalized(relation.join_type);
  if (relation.type === "setop") {
    const setop = normalized(relation.setop);
    if (setop === "UNION" && relation.all === true) return "UNION_ALL";
    return setop;
  }
  return normalized(relation.type);
}

function rootSubject(root: SemanticNormalizationRoot): SemanticSubject {
  return (
    root.targetSubject ?? {
      subjectKind: "PHYSICAL_FIELD",
      physicalFieldId: root.rootTargetFieldId,
    }
  );
}

function certaintyRank(value: PathCertainty): number {
  return value === "UNKNOWN" ? 2 : value === "CONDITIONAL" ? 1 : 0;
}

function worstCertainty(
  left: PathCertainty,
  right: PathCertainty,
): PathCertainty {
  return certaintyRank(left) >= certaintyRank(right) ? left : right;
}

function defaultRootKind(localEdgeKind: LocalEdgeKind): RootDependenceKind {
  return localEdgeKind === "VALUE_FLOW"
    ? VALUE_ROOT
    : localEdgeKind === "RELATION_CONTEXT"
      ? RELATION_ROOT
      : CONTROL_ROOT;
}

function inputProofRefs(
  relationId: string,
  column: ColumnRef,
): readonly ProofRef[] {
  return [factRef("column", relationId, `${column.clause}:${column.name}`)];
}

function relationOutputFields(
  relationId: string,
  byId: ReadonlyMap<string, RelationRecord>,
  plan: PlanFacts,
  resolver:
    | SemanticPhysicalFieldResolver
    | SemanticPhysicalFieldResolver["resolve"]
    | undefined,
  outputNames: ReadonlySet<string> | null = null,
): readonly {
  readonly subject: SemanticSubject;
  readonly refs: readonly ProofRef[];
}[] {
  const relation = byId.get(relationId);
  if (!relation) return [];
  const outputs: { subject: SemanticSubject; refs: readonly ProofRef[] }[] = [];
  if (relation.type === "project") {
    for (const expression of relation.expressions ?? []) {
      if (
        outputNames !== null &&
        !outputNames.has(normalized(expression.output))
      )
        continue;
      for (const column of expressionColumns(expression)) {
        const fields = physicalSubjects(column, resolver);
        for (const subject of fields.subjects)
          outputs.push({ subject, refs: fields.proofRefs });
      }
    }
  } else if (relation.type === "aggregate") {
    for (const expression of relation.measures ?? []) {
      if (
        outputNames !== null &&
        !outputNames.has(normalized(expression.output))
      )
        continue;
      for (const column of expressionColumns(expression)) {
        const fields = physicalSubjects(column, resolver);
        for (const subject of fields.subjects)
          outputs.push({ subject, refs: fields.proofRefs });
      }
    }
  }
  if (outputs.length > 0) return outputs;
  return childrenOf(relation).flatMap((child) =>
    relationOutputFields(child, byId, plan, resolver, outputNames),
  );
}

function querySupport(queryValue: Query) {
  return lookupOperatorSupport({
    ...queryValue,
    operatorVariant: queryValue.operatorVariant,
    operatorRole: queryValue.operatorRole,
  });
}

export function normalizeSemanticDependencies(
  input: SemanticDependencyNormalizerInput,
): SemanticDependencyNormalization {
  const byId = relationMap(input.plan);
  const definitions = new Map<string, SemanticDependencyDefinition>();
  const applications = new Map<string, SemanticDependencyApplication>();
  const edges = new Map<string, SemanticDependencyEdge>();
  const gaps = new Map<string, SemanticDependencyGap>();

  const addGap = (
    root: SemanticNormalizationRoot,
    relation: RelationRecord | null,
    queryValue: Query,
    message: string,
    supportRefs: readonly ProofRef[] = [],
    gapSubject?: SemanticSubject,
  ): void => {
    const supported = querySupport(queryValue);
    const relationId = relation?.id ?? null;
    const refs = [
      ...supportRefs,
      ...(relation
        ? [
            factRef("relation", relation.id),
            sourceSpanRef("relation", relation.id, relation.span),
          ]
        : []),
      ...(supported.gap?.proofRefs ?? supported.cell.proofRefs),
    ];
    const gapNamespace = input.idNamespace === undefined ? "" : `${input.idNamespace}:`;
    const gapId = `semantic-gap:${gapNamespace}${root.rootTargetFieldId}:${relationId ?? "root"}:${queryValue.operatorKind}:${queryValue.operatorVariant}:${queryValue.operatorRole}:${gapSubject ? JSON.stringify(gapSubject) : ""}:${message}`;
    gaps.set(gapId, {
      gapId,
      status: supported.gap?.status ?? "UNKNOWN",
      reasonCode: supported.gap?.reasonCode ?? "STRUCTURALLY_INCOMPLETE",
      operatorKind: queryValue.operatorKind,
      operatorVariant: queryValue.operatorVariant,
      operatorRole: queryValue.operatorRole,
      relationId,
      rootTargetFieldId: root.rootTargetFieldId,
      ...(gapSubject ? { subject: gapSubject } : {}),
      message: supported.gap?.message
        ? `${supported.gap.message} ${message}`
        : message,
      proofRefs: unique(refs, (ref) => ref.proofRefId),
      blocksNegativeProof: true,
    });
  };

  const addEvent = (args: {
    readonly root: SemanticNormalizationRoot;
    readonly relation: RelationRecord;
    readonly subject: SemanticSubject;
    readonly query: Query;
    readonly rootDependenceKind?: RootDependenceKind;
    readonly proofRefs: readonly ProofRef[];
    readonly structuralGap?: string;
  }): void => {
    const support = querySupport(args.query);
    const rootDependenceKind =
      args.rootDependenceKind ?? defaultRootKind(args.query.localEdgeKind);
    const refs = unique(
      [
        ...args.proofRefs,
        factRef("relation", args.relation.id),
        sourceSpanRef("relation", args.relation.id, args.relation.span),
        ...support.cell.proofRefs,
      ],
      (ref) => ref.proofRefId,
    );
    const definition = makeSemanticDependencyDefinition(
      {
        subject: args.subject,
        effectKind: args.query.effectKind,
        operatorKind: args.query.operatorKind,
        operatorVariant: args.query.operatorVariant,
        operatorRole: args.query.operatorRole,
        localEdgeKind: args.query.localEdgeKind,
      },
      support.cell.status as SupportStatus,
      refs,
      input.idNamespace,
    );
    const previousDefinition = definitions.get(definition.dependencyId);
    definitions.set(
      definition.dependencyId,
      previousDefinition
        ? {
            ...previousDefinition,
            proofRefs: unique(
              [...previousDefinition.proofRefs, ...definition.proofRefs],
              (ref) => ref.proofRefId,
            ),
          }
        : definition,
    );
    const blocked = Boolean(args.structuralGap) || !support.matched;
    const pathCertainty: PathCertainty = blocked
      ? "UNKNOWN"
      : support.cell.status === "SUPPORTED"
        ? "CONFIRMED"
        : "UNKNOWN";
    if (args.structuralGap)
      addGap(args.root, args.relation, args.query, args.structuralGap, refs);
    if (support.gap)
      addGap(args.root, args.relation, args.query, support.gap.message, refs);
    const application = makeSemanticDependencyApplication({
      dependencyId: definition.dependencyId,
      scopeRelationId: args.relation.id,
      rootTargetFieldId: args.root.rootTargetFieldId,
      rootDependenceKind,
      pathCertainty,
      proofRefs: refs,
    });
    const previousApplication = applications.get(application.applicationId);
    applications.set(
      application.applicationId,
      previousApplication
        ? {
            ...previousApplication,
            pathCertainty: worstCertainty(
              previousApplication.pathCertainty,
              application.pathCertainty,
            ),
            proofRefs: unique(
              [...previousApplication.proofRefs, ...application.proofRefs],
              (ref) => ref.proofRefId,
            ),
          }
        : application,
    );
    const edge = makeSemanticDependencyEdge({
      dependencyId: definition.dependencyId,
      fromSubject: args.subject,
      toSubject: rootSubject(args.root),
      rootDependenceKind,
      localEdgeKind: args.query.localEdgeKind,
      scopeRelationId: args.relation.id,
      pathCertainty,
      proofRefs: refs,
    });
    const previousEdge = edges.get(edge.edgeId);
    edges.set(
      edge.edgeId,
      previousEdge
        ? {
            ...previousEdge,
            pathCertainty: worstCertainty(
              previousEdge.pathCertainty,
              edge.pathCertainty,
            ),
            proofRefs: unique(
              [...previousEdge.proofRefs, ...edge.proofRefs],
              (ref) => ref.proofRefId,
            ),
          }
        : edge,
    );
  };

  const addColumns = (args: {
    readonly root: SemanticNormalizationRoot;
    readonly relation: RelationRecord;
    readonly columns: readonly ColumnRef[];
    readonly query: Query;
    readonly rootDependenceKind?: RootDependenceKind;
    readonly incompleteMessage?: string;
  }): void => {
    if (args.columns.length === 0) {
      addGap(
        args.root,
        args.relation,
        args.query,
        args.incompleteMessage ?? "semantic input columns are absent",
      );
      return;
    }
    for (const column of args.columns) {
      const physical = physicalSubjects(column, input.physicalFieldResolver);
      if (physical.subjects.length === 0) {
        addGap(
          args.root,
          args.relation,
          args.query,
          `physical identity is unavailable for ${column.name}`,
          inputProofRefs(args.relation.id, column),
        );
        continue;
      }
      for (const subject of physical.subjects)
        addEvent({
          root: args.root,
          relation: args.relation,
          subject,
          query: args.query,
          rootDependenceKind: args.rootDependenceKind,
          proofRefs: [
            ...inputProofRefs(args.relation.id, column),
            ...physical.proofRefs,
          ],
        });
      for (const unresolved of physical.unresolvedReferences) {
        addGap(
          args.root,
          args.relation,
          args.query,
          `physical identity is unavailable for ${unresolved.table}.${unresolved.column}`,
          [
            ...inputProofRefs(args.relation.id, column),
            createProofRef(
              "CANONICAL_FACT",
              `plan:physical:${unresolved.table}:${unresolved.column}`,
            ),
          ],
          {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: fallbackPhysicalFieldId(
              unresolved.table,
              unresolved.column,
            ),
          },
        );
      }
    }
  };

  const addRelationSubjects = (args: {
    readonly root: SemanticNormalizationRoot;
    readonly relation: RelationRecord;
    readonly relationIds: readonly string[];
    readonly query: Query;
  }): void => {
    if (args.relationIds.length === 0) {
      addGap(
        args.root,
        args.relation,
        args.query,
        "relation occurrence is missing",
      );
      return;
    }
    for (const relationId of args.relationIds) {
      const referenced = byId.get(relationId);
      if (!referenced) {
        addGap(
          args.root,
          args.relation,
          args.query,
          `relation occurrence ${relationId || "<missing>"} is unavailable`,
          [factRef("missing-relation", args.relation.id, relationId)],
        );
        continue;
      }
      addEvent({
        root: args.root,
        relation: args.relation,
        subject: relationSubject(input.plan, relationId),
        query: args.query,
        rootDependenceKind: RELATION_ROOT,
        proofRefs: [
          factRef("relation-occurrence", relationId),
          sourceSpanRef(
            "relation-occurrence",
            relationId,
            byId.get(relationId)?.span,
          ),
        ],
      });
    }
  };

  const processExpression = (
    root: SemanticNormalizationRoot,
    relation: RelationRecord,
    expression: ExprSpec,
    relationIds: readonly string[],
  ): void => {
    const roles = expressionRoles(expression);
    const kind = exprKind(expression);
    const structuredOperator =
      normalized(roles[0]?.operator) || expressionOperator(expression);
    const expressionKind = kind || "UNKNOWN_EXPRESSION";
    if (["CASE", "IF", "COALESCE"].includes(structuredOperator)) {
      if (roles.length === 0) {
        addGap(
          root,
          relation,
          query(
            "PROJECT",
            structuredOperator,
            "BRANCH_SELECTOR",
            "PHYSICAL_FIELD",
            "BRANCH_SELECTION",
            "EXPRESSION_CONTROL",
          ),
          "structured expression roles are missing",
        );
      }
      for (const role of roles) {
        const roleOperator = normalized(role.operator);
        const validRole = [
          "BRANCH_SELECTOR",
          "RESULT_VALUE",
          "COALESCE_ARGUMENT",
        ].includes(role.role);
        const validOperator = ["CASE", "IF", "COALESCE"].includes(roleOperator);
        const expectedEffects =
          role.role === "BRANCH_SELECTOR"
            ? ["BRANCH_SELECTION"]
            : role.role === "RESULT_VALUE"
              ? ["VALUE_CONTRIBUTION"]
              : ["BRANCH_SELECTION", "VALUE_CONTRIBUTION"];
        const actualEffects = (role.effects ?? []).map(normalized);
        if (
          !validRole ||
          !validOperator ||
          expectedEffects.some((effect) => !actualEffects.includes(effect)) ||
          actualEffects.some(
            (effect) => !expectedEffects.includes(effect as never),
          )
        ) {
          addGap(
            root,
            relation,
            query(
              "PROJECT",
              roleOperator || structuredOperator,
              "BRANCH_VALUE",
              "PHYSICAL_FIELD",
              "VALUE_CONTRIBUTION",
              "VALUE_FLOW",
            ),
            `expression role ${role.role || "<missing>"} is unmodeled or has invalid effects`,
          );
          continue;
        }
        const roleQueries = expectedEffects.map((effect) =>
          effect === "BRANCH_SELECTION"
            ? query(
                "PROJECT",
                roleOperator,
                "BRANCH_SELECTOR",
                "PHYSICAL_FIELD",
                "BRANCH_SELECTION",
                "EXPRESSION_CONTROL",
              )
            : query(
                "PROJECT",
                roleOperator,
                "BRANCH_VALUE",
                "PHYSICAL_FIELD",
                "VALUE_CONTRIBUTION",
                "VALUE_FLOW",
              ),
        );
        for (const roleQuery of roleQueries)
          addColumns({
            root,
            relation,
            columns: columnsOf(role.input_columns),
            query: roleQuery,
            rootDependenceKind:
              roleQuery.localEdgeKind === "VALUE_FLOW"
                ? VALUE_ROOT
                : CONTROL_ROOT,
            incompleteMessage: `expression role ${role.role} has no input columns`,
          });
      }
      const functions = expression.expression_facts?.functions ?? [];
      const rolesDescribeWholeExpression =
        !expression.window_spec &&
        (functions.length === 0 ||
          expressionKind === structuredOperator ||
          canonicalStructuredFunction(functions[0]) === structuredOperator);
      if (rolesDescribeWholeExpression) return;
    }
    if (roles.length > 0) {
      if (!["CASE", "IF", "COALESCE"].includes(structuredOperator))
        addGap(
          root,
          relation,
          query(
            "PROJECT",
            structuredOperator || expressionKind,
            "VALUE",
            "PHYSICAL_FIELD",
            "VALUE_CONTRIBUTION",
            "VALUE_FLOW",
          ),
          "expression roles use an unsupported operator",
        );
    }
    if (expression.window_spec) {
      for (const binding of expression.window_spec.input_bindings ?? [])
        processWindowBinding(root, relation, binding);
      const frame = expression.window_spec.frame;
      const frameQuery = query(
        "WINDOW",
        "WINDOW_FRAME",
        "FRAME_BOUND",
        "PHYSICAL_FIELD",
        "WINDOW_CONTEXT",
        "WINDOW_CONTEXT",
      );
      if (
        !frame ||
        frame.status !== "EXTRACTED" ||
        !text(frame.expression_text) ||
        !frame.span
      )
        addGap(
          root,
          relation,
          frameQuery,
          frame?.reason ?? "window frame structure is unknown or empty",
        );
      else if (columnsOf(frame.input_columns).length > 0)
        addColumns({
          root,
          relation,
          columns: columnsOf(frame.input_columns),
          query: frameQuery,
          rootDependenceKind: CONTROL_ROOT,
          incompleteMessage: "window frame input columns are missing",
        });
      return;
    }
    if (hasCountStar(expression)) {
      addRelationSubjects({
        root,
        relation,
        relationIds,
        query: query(
          "AGGREGATE",
          "COUNT_STAR",
          "RELATION",
          "RELATION_OCCURRENCE",
          "RELATION_EXISTENCE",
          "RELATION_CONTEXT",
        ),
      });
      addRelationSubjects({
        root,
        relation,
        relationIds,
        query: query(
          "AGGREGATE",
          "COUNT_STAR",
          "RELATION",
          "RELATION_OCCURRENCE",
          "MULTIPLICITY",
          "RELATION_CONTEXT",
        ),
      });
      return;
    }
    if (expressionKind === "SUBQUERY") {
      const rawSubqueryIds = asRecord(expression).subquery_relation_ids;
      const subqueryQuery = query(
        "SUBQUERY",
        "EXISTS",
        "RELATION",
        "RELATION_OCCURRENCE",
        "RELATION_EXISTENCE",
        "RELATION_CONTEXT",
      );
      if (!Array.isArray(rawSubqueryIds) || rawSubqueryIds.length === 0)
        addGap(
          root,
          relation,
          subqueryQuery,
          "subquery relation IDs are missing",
        );
      else
        addRelationSubjects({
          root,
          relation,
          relationIds: rawSubqueryIds.map(text),
          query: subqueryQuery,
        });
    }
    if (!MODELED_EXPRESSION_KINDS.has(expressionKind)) {
      addGap(
        root,
        relation,
        query(
          "PROJECT",
          expressionKind,
          "VALUE",
          "PHYSICAL_FIELD",
          "VALUE_CONTRIBUTION",
          "VALUE_FLOW",
        ),
        `expression kind ${expressionKind} is not modeled`,
      );
      return;
    }
    const operatorKind = expressionKind === "SUBQUERY" ? "SUBQUERY" : "PROJECT";
    const operatorVariant =
      expressionKind === "SUBQUERY" ? "SCALAR" : "COLUMN_EXPRESSION";
    const valueColumns = expressionColumns(expression);
    if (valueColumns.length > 0)
      addColumns({
        root,
        relation,
        columns: valueColumns,
        query: query(
          operatorKind,
          operatorVariant,
          "VALUE",
          "PHYSICAL_FIELD",
          "VALUE_CONTRIBUTION",
          "VALUE_FLOW",
        ),
        rootDependenceKind: VALUE_ROOT,
        incompleteMessage: "value expression has no physical input columns",
      });
    if (expressionKind === "SUBQUERY" && valueColumns.length === 0)
      addGap(
        root,
        relation,
        query(
          "SUBQUERY",
          "SCALAR",
          "VALUE",
          "PHYSICAL_FIELD",
          "VALUE_CONTRIBUTION",
          "VALUE_FLOW",
        ),
        "scalar subquery has no physical field binding",
      );
    if (expressionKind === "LITERAL")
      addRelationSubjects({
        root,
        relation,
        relationIds,
        query: query(
          "RELATION",
          "LITERAL_FROM_RELATION",
          "RELATION",
          "RELATION_OCCURRENCE",
          "RELATION_EXISTENCE",
          "RELATION_CONTEXT",
        ),
      });
  };

  function processWindowBinding(
    root: SemanticNormalizationRoot,
    relation: RelationRecord,
    binding: WindowInputBinding,
  ): void {
    const role = normalized(binding.role);
    if (!["VALUE", "WINDOW_PARTITION", "WINDOW_ORDER"].includes(role)) {
      addGap(
        root,
        relation,
        query(
          "WINDOW",
          "WINDOW_VALUE",
          "WINDOW_INPUT",
          "PHYSICAL_FIELD",
          "VALUE_CONTRIBUTION",
          "VALUE_FLOW",
        ),
        `window input role ${role || "<missing>"} is not modeled`,
      );
      return;
    }
    const variant =
      role === "WINDOW_PARTITION"
        ? "WINDOW_PARTITION_BY"
        : role === "WINDOW_ORDER"
          ? "WINDOW_ORDER_BY"
          : "WINDOW_VALUE";
    const roleName =
      role === "WINDOW_PARTITION"
        ? "PARTITION_KEY"
        : role === "WINDOW_ORDER"
          ? "ORDER_KEY"
          : "WINDOW_INPUT";
    const effect =
      role === "WINDOW_PARTITION"
        ? "GROUPING"
        : role === "WINDOW_ORDER"
          ? "ORDERING"
          : "VALUE_CONTRIBUTION";
    const edge = role === "VALUE" ? "VALUE_FLOW" : "WINDOW_CONTEXT";
    addColumns({
      root,
      relation,
      columns: columnsOf(binding.input_columns),
      query: query("WINDOW", variant, roleName, "PHYSICAL_FIELD", effect, edge),
      rootDependenceKind: edge === "VALUE_FLOW" ? VALUE_ROOT : CONTROL_ROOT,
      incompleteMessage: `window ${role || "input"} binding has no input columns`,
    });
  }

  type OutputDemand = readonly ReadonlySet<string>[] | null;

  const selectedExpressionsByRelation = new Map<string, readonly ExprSpec[]>();
  const demandedOutputsByRelation = new Map<string, OutputDemand>();

  function expressionSelection(
    relation: RelationRecord,
    demandedOutputs: OutputDemand,
  ): readonly ExprSpec[] {
    const expressions =
      relation.type === "project"
        ? (relation.expressions ?? [])
        : relation.type === "aggregate"
          ? (relation.measures ?? [])
          : [];
    if (demandedOutputs === null)
      return expressions.length === 1 ? [expressions[0]!] : [];
    for (const demand of demandedOutputs) {
      const selected = expressions.filter((expression) =>
        demand.has(normalized(expression.output)),
      );
      if (selected.length > 0) return selected;
    }
    return [];
  }

  function expressionDemand(expressions: readonly ExprSpec[]): OutputDemand {
    const aliases = new Set<string>();
    const inputs = new Set<string>();
    for (const expression of expressions) {
      if (text(expression.output)) aliases.add(normalized(expression.output));
      for (const column of expressionColumns(expression))
        if (text(column.name)) inputs.add(normalized(column.name));
    }
    const demand: ReadonlySet<string>[] = [];
    if (aliases.size > 0) demand.push(aliases);
    if (inputs.size > 0) demand.push(inputs);
    return demand;
  }

  function computeRootSelections(
    root: SemanticNormalizationRoot,
    targetRelationId: string,
  ): void {
    selectedExpressionsByRelation.clear();
    demandedOutputsByRelation.clear();
    const initialDemand = root.outputName
      ? [new Set([normalized(root.outputName)])]
      : null;
    const queue: {
      relationId: string;
      demandedOutputs: OutputDemand;
    }[] = [{ relationId: targetRelationId, demandedOutputs: initialDemand }];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      const relation = byId.get(current.relationId);
      if (!relation) continue;
      const demandKey = current.demandedOutputs
        ? current.demandedOutputs
            .map((demand) => [...demand].sort(compareText).join(","))
            .join(">")
        : "*";
      const visitKey = `${current.relationId}|${demandKey}`;
      if (seen.has(visitKey)) continue;
      seen.add(visitKey);
      demandedOutputsByRelation.set(
        current.relationId,
        current.demandedOutputs,
      );
      if (relation.type === "project" || relation.type === "aggregate") {
        const selected = expressionSelection(relation, current.demandedOutputs);
        selectedExpressionsByRelation.set(relation.id, selected);
        const demand = expressionDemand(selected);
        for (const child of childrenOf(relation))
          queue.push({ relationId: child, demandedOutputs: demand });
        continue;
      }
      for (const child of childrenOf(relation))
        queue.push({
          relationId: child,
          demandedOutputs: current.demandedOutputs,
        });
    }
    // A missing output binding is not an invitation to inspect every sibling.
    // Keep an explicit gap at the relation source and leave the selection
    // empty, so the caller cannot accidentally prove unrelatedness.
    for (const [relationId, selected] of selectedExpressionsByRelation) {
      if (selected.length > 0) continue;
      const relation = byId.get(relationId);
      if (relation)
        addGap(
          root,
          relation,
          structuralQuery(relation),
          `target output ${root.outputName || "<unspecified>"} has no canonical expression binding`,
        );
    }
  }

  function structuralQuery(relation: RelationRecord): Query {
    if (relation.type === "filter")
      return query(
        "FILTER",
        relationVariant(relation) || "WHERE",
        "PREDICATE",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
    if (relation.type === "join")
      return query(
        "JOIN",
        relationVariant(relation) || "INNER",
        "JOIN_CONDITION",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
    if (relation.type === "setop")
      return query(
        "SETOP",
        relationVariant(relation) || "UNION",
        "SET_MEMBER",
        "PHYSICAL_FIELD",
        "SET_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
    if (relation.type === "top_n")
      return query(
        "TOP_N",
        normalized(asRecord(relation.limit).kind) || "LIMIT",
        "RANK_LIMIT",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
    return query(
      "PROJECT",
      "COLUMN_EXPRESSION",
      "VALUE",
      "PHYSICAL_FIELD",
      "VALUE_CONTRIBUTION",
      "VALUE_FLOW",
    );
  }

  function validateRelationReferences(
    root: SemanticNormalizationRoot,
    relation: RelationRecord,
  ): void {
    const references = relationReferences(relation);
    const referenceQuery = structuralQuery(relation);
    if (references.length === 0 && relation.type !== "read") {
      addGap(root, relation, referenceQuery, "relation source is missing");
      return;
    }
    for (const reference of references) {
      if (reference.id && byId.has(reference.id)) continue;
      addGap(
        root,
        relation,
        referenceQuery,
        `relation reference ${reference.field}=${reference.id || "<missing>"} is unavailable`,
        [
          factRef(
            "missing-relation",
            relation.id,
            reference.id || reference.field,
          ),
        ],
      );
    }
  }

  const processRelation = (
    root: SemanticNormalizationRoot,
    relation: RelationRecord,
    descendants: ReadonlySet<string>,
  ): void => {
    const genericQuery = query(
      relation.type === "filter"
        ? "FILTER"
        : relation.type === "join"
          ? "JOIN"
          : relation.type === "aggregate"
            ? "AGGREGATE"
            : relation.type === "setop"
              ? "SETOP"
              : relation.type === "top_n"
                ? "TOP_N"
                : "PROJECT",
      relation.type === "other"
        ? normalized(relation.body_kind) || "OTHER"
        : relation.type === "filter"
          ? relationVariant(relation)
          : relation.type === "join"
            ? relationVariant(relation)
            : relation.type === "setop"
              ? relationVariant(relation)
              : relation.type === "top_n"
                ? normalized(asRecord(relation.limit).kind) || "LIMIT"
                : "COLUMN_EXPRESSION",
      "VALUE",
      "PHYSICAL_FIELD",
      "VALUE_CONTRIBUTION",
      "VALUE_FLOW",
    );
    if (relation.provenance === "unknown")
      addGap(
        root,
        relation,
        genericQuery,
        "relation provenance is structurally incomplete",
      );
    for (const unknown of input.plan.unknowns)
      if (unknown.node_id === relation.id)
        addGap(
          root,
          relation,
          genericQuery,
          unknown.reason,
          unknown.span
            ? [sourceSpanRef("unknown", relation.id, unknown.span)]
            : [],
        );
    const relationIds = [...descendants]
      .filter((id) => byId.get(id)?.type === "read")
      .sort(compareText);
    if (relation.type === "project") {
      for (const expression of selectedExpressionsByRelation.get(relation.id) ??
        [])
        processExpression(root, relation, expression, relationIds);
      const distinct = Boolean(
        relation.distinct ?? relation.is_distinct ?? relation.deduplicate,
      );
      if (distinct) {
        for (const expression of selectedExpressionsByRelation.get(
          relation.id,
        ) ?? [])
          addColumns({
            root,
            relation,
            columns: expressionColumns(expression),
            query: query(
              "DISTINCT",
              "DISTINCT_KEY",
              "VALUE",
              "PHYSICAL_FIELD",
              "SET_MEMBERSHIP",
              "ROWSET_CONTROL",
            ),
            rootDependenceKind: CONTROL_ROOT,
            incompleteMessage: "distinct key has no physical input columns",
          });
      }
      return;
    }
    if (relation.type === "filter") {
      const variant = relationVariant(relation);
      const predicateQuery = query(
        "FILTER",
        variant,
        "PREDICATE",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
      const predicateColumns = relationColumns(relation);
      if (predicateColumns.length > 0)
        addColumns({
          root,
          relation,
          columns: predicateColumns,
          query: predicateQuery,
          rootDependenceKind: CONTROL_ROOT,
          incompleteMessage: `${variant || "FILTER"} predicate columns are missing`,
        });
      if (!relation.predicate_tree)
        addGap(
          root,
          relation,
          predicateQuery,
          "predicate tree is structurally incomplete",
        );
      if (relation.contains_subquery) {
        const facts = relation.predicate_facts;
        const functions = facts?.functions?.map(normalized) ?? [];
        const variant = functions.includes("IN") ? "IN" : "EXISTS";
        const rawSubqueryIds = relation.subquery_relation_ids;
        const hasSubqueryIds = Array.isArray(rawSubqueryIds);
        const explicitSubqueryRelations = hasSubqueryIds
          ? rawSubqueryIds.map(text)
          : [];
        const subqueryQuery = query(
          "SUBQUERY",
          variant,
          "RELATION",
          "RELATION_OCCURRENCE",
          variant === "IN" ? "SET_MEMBERSHIP" : "RELATION_EXISTENCE",
          "RELATION_CONTEXT",
        );
        if (!hasSubqueryIds || explicitSubqueryRelations.length === 0)
          addGap(
            root,
            relation,
            subqueryQuery,
            "subquery relation IDs are missing",
          );
        if (explicitSubqueryRelations.length > 0)
          addRelationSubjects({
            root,
            relation,
            relationIds: explicitSubqueryRelations,
            query: subqueryQuery,
          });
      }
      return;
    }
    if (relation.type === "join") {
      const variant = relationVariant(relation);
      if (variant === "CROSS") {
        const children = childrenOf(relation);
        addRelationSubjects({
          root,
          relation,
          relationIds: children.slice(0, 1),
          query: query(
            "JOIN",
            "CROSS",
            "LEFT_INPUT",
            "RELATION_OCCURRENCE",
            "MULTIPLICITY",
            "RELATION_CONTEXT",
          ),
        });
        addRelationSubjects({
          root,
          relation,
          relationIds: children.slice(1, 2),
          query: query(
            "JOIN",
            "CROSS",
            "RIGHT_INPUT",
            "RELATION_OCCURRENCE",
            "MULTIPLICITY",
            "RELATION_CONTEXT",
          ),
        });
        addRelationSubjects({
          root,
          relation,
          relationIds: children,
          query: query(
            "RELATION",
            "CROSS_JOIN",
            "CARDINALITY",
            "RELATION_OCCURRENCE",
            "MULTIPLICITY",
            "RELATION_CONTEXT",
          ),
        });
        return;
      }
      const joinQuery = query(
        "JOIN",
        variant,
        "JOIN_CONDITION",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
      addColumns({
        root,
        relation,
        columns: relationColumns(relation),
        query: joinQuery,
        rootDependenceKind: CONTROL_ROOT,
        incompleteMessage: `${variant || "JOIN"} condition columns are missing`,
      });
      if (!relation.condition_expr && !relation.using)
        addGap(
          root,
          relation,
          joinQuery,
          "non-cross join condition is missing",
        );
      return;
    }
    if (relation.type === "aggregate") {
      const groupQuery = query(
        "AGGREGATE",
        "GROUP_BY",
        "GROUP_KEY",
        "PHYSICAL_FIELD",
        "GROUPING",
        "ROWSET_CONTROL",
      );
      const groupColumns = relationColumns(relation);
      if (groupColumns.length > 0)
        addColumns({
          root,
          relation,
          columns: groupColumns,
          query: groupQuery,
          rootDependenceKind: CONTROL_ROOT,
          incompleteMessage:
            "group-by key is absent from the canonical projection",
        });
      if (
        (relation.group_by_exprs?.length ?? 0) > 0 &&
        groupColumns.length === 0
      )
        addGap(
          root,
          relation,
          groupQuery,
          "complex group-by expression has no field bindings",
        );
      for (const measure of selectedExpressionsByRelation.get(relation.id) ??
        []) {
        if (hasCountStar(measure)) {
          processExpression(root, relation, measure, relationIds);
          continue;
        }
        const measureColumns = expressionColumns(measure);
        if (measureColumns.length > 0)
          addColumns({
            root,
            relation,
            columns: measureColumns,
            query: query(
              "AGGREGATE",
              "AGGREGATE_INPUT",
              "AGGREGATE_ARGUMENT",
              "PHYSICAL_FIELD",
              "VALUE_CONTRIBUTION",
              "VALUE_FLOW",
            ),
            rootDependenceKind: VALUE_ROOT,
            incompleteMessage:
              "aggregate measure has no physical input columns",
          });
      }
      return;
    }
    if (relation.type === "setop") {
      const variant = relationVariant(relation);
      const setQuery = query(
        "SETOP",
        variant,
        "SET_MEMBER",
        "PHYSICAL_FIELD",
        "SET_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
      const branches = Array.isArray(relation.branches)
        ? relation.branches.map(text).filter(Boolean)
        : [];
      if (branches.length === 0) {
        addGap(root, relation, setQuery, "set operation branches are missing");
        return;
      }
      for (const branch of branches) {
        const selectedBranch = selectedExpressionsByRelation.get(branch);
        const demanded = selectedBranch
          ? new Set(
              selectedBranch.map((expression) => normalized(expression.output)),
            )
          : (demandedOutputsByRelation.get(branch)?.[0] ?? null);
        for (const output of relationOutputFields(
          branch,
          byId,
          input.plan,
          input.physicalFieldResolver,
          demanded,
        ))
          if (output.subject.subjectKind === "PHYSICAL_FIELD")
            addEvent({
              root,
              relation,
              subject: output.subject,
              query: setQuery,
              rootDependenceKind: CONTROL_ROOT,
              proofRefs: output.refs,
            });
        if (variant === "UNION_ALL")
          for (const output of relationOutputFields(
            branch,
            byId,
            input.plan,
            input.physicalFieldResolver,
            demanded,
          ))
            if (output.subject.subjectKind === "PHYSICAL_FIELD")
              addEvent({
                root,
                relation,
                subject: output.subject,
                query: query(
                  "SETOP",
                  "UNION_ALL",
                  "SET_MEMBER",
                  "PHYSICAL_FIELD",
                  "MULTIPLICITY",
                  "ROWSET_CONTROL",
                ),
                rootDependenceKind: CONTROL_ROOT,
                proofRefs: output.refs,
              });
      }
      return;
    }
    if (relation.type === "top_n") {
      const limitKind = normalized(asRecord(relation.limit).kind);
      const variant =
        limitKind === "OFFSET_FETCH" ? "FETCH" : limitKind || "LIMIT";
      const topQuery = query(
        "TOP_N",
        variant,
        "RANK_LIMIT",
        "PHYSICAL_FIELD",
        "ROW_MEMBERSHIP",
        "ROWSET_CONTROL",
      );
      if (!["LIMIT", "TOP", "OFFSET_FETCH"].includes(limitKind))
        addGap(
          root,
          relation,
          topQuery,
          "Top-N limit kind is missing or unmodeled",
        );
      const order = Array.isArray(relation.order_by) ? relation.order_by : [];
      for (const binding of order)
        columnsOf(binding.input_columns).length > 0
          ? addColumns({
              root,
              relation,
              columns: columnsOf(binding.input_columns),
              query: query(
                "TOP_N",
                variant,
                "ORDER_KEY",
                "PHYSICAL_FIELD",
                "ORDERING",
                "ROWSET_CONTROL",
              ),
              rootDependenceKind: CONTROL_ROOT,
              incompleteMessage:
                "Top-N order key has no physical input columns",
            })
          : text(binding.expression_text)
            ? undefined
            : addGap(
                root,
                relation,
                query(
                  "TOP_N",
                  variant,
                  "ORDER_KEY",
                  "PHYSICAL_FIELD",
                  "ORDERING",
                  "ROWSET_CONTROL",
                ),
                "Top-N order key is structurally incomplete",
              );
      const limit = asRecord(relation.limit);
      for (const role of ["top", "offset", "fetch"] as const) {
        const binding = asRecord(limit[role]);
        if (Object.keys(binding).length > 0)
          columnsOf(binding.input_columns).length > 0
            ? addColumns({
                root,
                relation,
                columns: columnsOf(binding.input_columns),
                query: topQuery,
                rootDependenceKind: CONTROL_ROOT,
                incompleteMessage: `Top-N ${role} binding has no physical input columns`,
              })
            : text(binding.expression_text)
              ? undefined
              : addGap(
                  root,
                  relation,
                  topQuery,
                  `Top-N ${role} binding is structurally incomplete`,
                );
      }
      if (relation.span_status !== "EXTRACTED" || !relation.span)
        addGap(
          root,
          relation,
          topQuery,
          "Top-N span is structurally incomplete",
        );
      if (order.length === 0)
        addGap(root, relation, topQuery, "Top-N has no ordering input");
      return;
    }
    if (relation.type === "read") {
      // A physical READ is an evidence boundary.  It is not an unsupported
      // semantic operator; field identities and explicit relation-context
      // dependencies are emitted by the consuming operator above it.
      return;
    }
    const unknownQuery = query(
      "RELATION",
      normalized(relation.body_kind) || normalized(relation.type),
      "RELATION",
      "RELATION_OCCURRENCE",
      "RELATION_EXISTENCE",
      "RELATION_CONTEXT",
    );
    addGap(
      root,
      relation,
      unknownQuery,
      "relation operator is not modeled by the native normalizer",
    );
  };

  function planRoot(plan: PlanFacts): string {
    return plan.roots[0] ?? "";
  }

  for (const root of input.roots) {
    const targetRelationId = root.relationId ?? planRoot(input.plan);
    const reachable = descendantIds(targetRelationId, byId);
    if (!byId.has(targetRelationId)) {
      addGap(
        root,
        null,
        query(
          "PROJECT",
          "COLUMN_EXPRESSION",
          "VALUE",
          "PHYSICAL_FIELD",
          "VALUE_CONTRIBUTION",
          "VALUE_FLOW",
        ),
        `root relation ${targetRelationId || "<missing>"} is unavailable`,
      );
      continue;
    }
    computeRootSelections(root, targetRelationId);
    for (const relationId of [...reachable].sort(compareText)) {
      const relation = byId.get(relationId);
      if (relation) validateRelationReferences(root, relation);
    }
    for (const relationId of [...reachable].sort(compareText)) {
      const relation = byId.get(relationId);
      if (relation) processRelation(root, relation, reachable);
    }
  }

  const orderedDefinitions = [...definitions.values()].sort((left, right) =>
    compareText(left.dependencyId, right.dependencyId),
  );
  const orderedApplications = [...applications.values()].sort((left, right) =>
    compareText(left.applicationId, right.applicationId),
  );
  const orderedEdges = [...edges.values()].sort((left, right) =>
    compareText(left.edgeId, right.edgeId),
  );
  const orderedGaps = [...gaps.values()].sort((left, right) =>
    compareText(left.gapId, right.gapId),
  );
  return {
    definitions: orderedDefinitions,
    applications: orderedApplications,
    edges: orderedEdges,
    semanticEdges: orderedEdges,
    gaps: orderedGaps,
    legacyEdges: [...(input.legacyEdges ?? [])],
  };
}

/** Explicit alias for callers that use the Plan Facts wording. */
export const normalizePlanSemanticDependencies = normalizeSemanticDependencies;

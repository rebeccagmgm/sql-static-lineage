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
} from "./field-lineage-contract.ts";

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
  return `relation:${plan.meta.statement_index}:${relationId}`;
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
  readonly unresolved: boolean;
} {
  const physical = column.physical;
  if (!Array.isArray(physical) || physical.length === 0)
    return { subjects: [], proofRefs: [], unresolved: true };
  const subjects: SemanticSubject[] = [];
  const proofRefs: ProofRef[] = [];
  let unresolved = false;
  for (const reference of physical) {
    const table = text(reference.table);
    const field = text(reference.column);
    if (!table || !field) {
      unresolved = true;
      continue;
    }
    const resolved =
      typeof resolver === "function"
        ? resolver({ table, column: field }, column)
        : resolver?.resolve({ table, column: field }, column);
    if (resolver && !resolved) {
      unresolved = true;
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
    unresolved: unresolved || subjects.length === 0,
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
  return (
    isFunction(expression, "COUNT") &&
    expressionColumns(expression).length === 0
  );
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
      relation.filter_kind ??
        relation.clause ??
        relation.filter_clause ??
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

function isTargetExpression(
  relationId: string,
  targetRelationId: string,
  expression: ExprSpec,
  root: SemanticNormalizationRoot,
): boolean {
  if (relationId !== targetRelationId) return true;
  return (
    !root.outputName ||
    normalized(expression.output) === normalized(root.outputName)
  );
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
): readonly {
  readonly subject: SemanticSubject;
  readonly refs: readonly ProofRef[];
}[] {
  const relation = byId.get(relationId);
  if (!relation) return [];
  const outputs: { subject: SemanticSubject; refs: readonly ProofRef[] }[] = [];
  if (relation.type === "project") {
    for (const expression of relation.expressions ?? []) {
      for (const column of expressionColumns(expression)) {
        const fields = physicalSubjects(column, resolver);
        for (const subject of fields.subjects)
          outputs.push({ subject, refs: fields.proofRefs });
      }
    }
  } else if (relation.type === "aggregate") {
    for (const expression of relation.measures ?? []) {
      for (const column of expressionColumns(expression)) {
        const fields = physicalSubjects(column, resolver);
        for (const subject of fields.subjects)
          outputs.push({ subject, refs: fields.proofRefs });
      }
    }
  }
  if (outputs.length > 0) return outputs;
  return childrenOf(relation).flatMap((child) =>
    relationOutputFields(child, byId, plan, resolver),
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
    const gapId = `semantic-gap:${root.rootTargetFieldId}:${relationId ?? "root"}:${queryValue.operatorKind}:${queryValue.operatorVariant}:${queryValue.operatorRole}:${message}`;
    gaps.set(gapId, {
      gapId,
      status: supported.gap?.status ?? "UNKNOWN",
      reasonCode: supported.gap?.reasonCode ?? "STRUCTURALLY_INCOMPLETE",
      operatorKind: queryValue.operatorKind,
      operatorVariant: queryValue.operatorVariant,
      operatorRole: queryValue.operatorRole,
      relationId,
      rootTargetFieldId: root.rootTargetFieldId,
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
          structuralGap: physical.unresolved
            ? `one or more physical identities for ${column.name} are unresolved`
            : undefined,
        });
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
    for (const relationId of args.relationIds)
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
  };

  const processExpression = (
    root: SemanticNormalizationRoot,
    relation: RelationRecord,
    expression: ExprSpec,
    relationIds: readonly string[],
  ): void => {
    if (
      !isTargetExpression(
        relation.id,
        root.relationId ?? planRoot(input.plan),
        expression,
        root,
      )
    )
      return;
    const roles = expressionRoles(expression);
    const kind = exprKind(expression);
    const expressionOperator = normalized(roles[0]?.operator) || kind;
    if (["CASE", "IF", "COALESCE"].includes(expressionOperator)) {
      if (roles.length === 0) {
        addGap(
          root,
          relation,
          query(
            "PROJECT",
            expressionOperator,
            "BRANCH_SELECTOR",
            "PHYSICAL_FIELD",
            "BRANCH_SELECTION",
            "EXPRESSION_CONTROL",
          ),
          "structured expression roles are missing",
        );
      }
      for (const role of roles) {
        const roleQueries =
          role.role === "BRANCH_SELECTOR"
            ? [
                query(
                  "PROJECT",
                  expressionOperator,
                  "BRANCH_SELECTOR",
                  "PHYSICAL_FIELD",
                  "BRANCH_SELECTION",
                  "EXPRESSION_CONTROL",
                ),
              ]
            : role.role === "COALESCE_ARGUMENT"
              ? [
                  query(
                    "PROJECT",
                    expressionOperator,
                    "BRANCH_SELECTOR",
                    "PHYSICAL_FIELD",
                    "BRANCH_SELECTION",
                    "EXPRESSION_CONTROL",
                  ),
                  query(
                    "PROJECT",
                    expressionOperator,
                    "BRANCH_VALUE",
                    "PHYSICAL_FIELD",
                    "VALUE_CONTRIBUTION",
                    "VALUE_FLOW",
                  ),
                ]
              : [
                  query(
                    "PROJECT",
                    kind,
                    "BRANCH_VALUE",
                    "PHYSICAL_FIELD",
                    "VALUE_CONTRIBUTION",
                    "VALUE_FLOW",
                  ),
                ];
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
      return;
    }
    if (expression.window_spec) {
      for (const binding of expression.window_spec.input_bindings ?? [])
        processWindowBinding(root, relation, binding);
      const frame = expression.window_spec.frame;
      if (frame?.status === "UNKNOWN")
        addGap(
          root,
          relation,
          query(
            "WINDOW",
            "WINDOW_FRAME",
            "FRAME_BOUND",
            "PHYSICAL_FIELD",
            "WINDOW_CONTEXT",
            "WINDOW_CONTEXT",
          ),
          frame.reason ?? "window frame structure is unknown",
        );
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
    const operatorKind = kind === "SUBQUERY" ? "SUBQUERY" : "PROJECT";
    const operatorVariant =
      kind === "SUBQUERY" ? "SCALAR" : "COLUMN_EXPRESSION";
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
    if (kind === "SUBQUERY" && valueColumns.length === 0)
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
    if (kind === "LITERAL" && relationIds.length > 0)
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
    const edge = role === "WINDOW_VALUE" ? "VALUE_FLOW" : "WINDOW_CONTEXT";
    addColumns({
      root,
      relation,
      columns: columnsOf(binding.input_columns),
      query: query("WINDOW", variant, roleName, "PHYSICAL_FIELD", effect, edge),
      rootDependenceKind: edge === "VALUE_FLOW" ? VALUE_ROOT : CONTROL_ROOT,
      incompleteMessage: `window ${role || "input"} binding has no input columns`,
    });
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
        addGap(root, relation, genericQuery, unknown.reason);
    const relationIds = [...descendants]
      .filter((id) => byId.get(id)?.type === "read")
      .sort(compareText);
    if (relation.type === "project") {
      for (const expression of relation.expressions ?? [])
        processExpression(root, relation, expression, relationIds);
      const distinct = Boolean(
        relation.distinct ?? relation.is_distinct ?? relation.deduplicate,
      );
      if (distinct) {
        for (const expression of relation.expressions ?? [])
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
        const explicitSubqueryRelations = Array.isArray(
          relation.subquery_relation_ids,
        )
          ? relation.subquery_relation_ids.map(text).filter(Boolean)
          : [];
        addRelationSubjects({
          root,
          relation,
          relationIds:
            explicitSubqueryRelations.length > 0
              ? explicitSubqueryRelations
              : relationIds,
          query: query(
            "SUBQUERY",
            variant,
            "RELATION",
            "RELATION_OCCURRENCE",
            variant === "IN" ? "SET_MEMBERSHIP" : "RELATION_EXISTENCE",
            "RELATION_CONTEXT",
          ),
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
      for (const measure of relation.measures ?? []) {
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
        for (const output of relationOutputFields(
          branch,
          byId,
          input.plan,
          input.physicalFieldResolver,
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
      const order = Array.isArray(relation.order_by) ? relation.order_by : [];
      for (const binding of order)
        addColumns({
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
          incompleteMessage: "Top-N order key has no physical input columns",
        });
      const limit = asRecord(relation.limit);
      for (const role of ["top", "offset", "fetch"] as const) {
        const binding = asRecord(limit[role]);
        if (Object.keys(binding).length > 0)
          addColumns({
            root,
            relation,
            columns: columnsOf(binding.input_columns),
            query: topQuery,
            rootDependenceKind: CONTROL_ROOT,
            incompleteMessage: `Top-N ${role} binding has no physical input columns`,
          });
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

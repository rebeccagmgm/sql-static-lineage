import type {
  PhysicalTableCatalog,
  PhysicalTableCatalogEntry,
} from "../../machine-facts/input-pack-machine-facts.ts";
import {
  normalizeName,
  type InputDependencyStatus,
} from "../../machine-facts/machine-facts-contract.ts";
import type {
  CurrentBundleLoad,
  JsonRecord,
} from "../../query/current-task-bundle.ts";
import type { FieldConditionalAnnotation } from "../../reconcile/shared/field-control-contract.ts";
import {
  physicalFieldKey,
  type PhysicalFieldIdentity,
} from "../../reconcile/shared/physical-field.ts";
import { resolvePhysicalInputField } from "../../reconcile/shared/physical-field-resolver.ts";
import type { TaskDefaultSchema } from "../../reconcile/shared/task-default-schema.ts";

type FieldExpressionDependencyIndexes = {
  readonly expressions: ReadonlyMap<string, JsonRecord>;
  readonly relations: ReadonlyMap<string, JsonRecord>;
  readonly valueInputFieldsByExpressionId: ReadonlyMap<
    string,
    readonly JsonRecord[]
  >;
};

export type FieldDependencySourceResult = {
  fields: PhysicalFieldIdentity[];
  unresolved: {
    table: string;
    column: string;
    reason: string;
  }[];
};

export type FieldConditionalNode = {
  readonly nodeId: string;
  readonly taskId: string;
  readonly field: Pick<PhysicalFieldIdentity, "column">;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}

const INPUT_DEPENDENCY_STATUSES = new Set<InputDependencyStatus>([
  "PHYSICAL",
  "DERIVED_OUTPUT",
  "SQL_CANDIDATE",
  "PARTIAL",
  "UNRESOLVED",
  "NO_PHYSICAL_INPUT",
]);

export function valueContributionInputFields(
  value: unknown,
  outputName: string,
): JsonRecord[] | null {
  const normalizedOutput = normalizeName(outputName);
  if (!normalizedOutput) return null;
  const matches: JsonRecord[] = [];
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    const record = asRecord(candidate);
    if (!record) return;
    const candidateOutput = normalizeName(
      String(record.output ?? record.output_name ?? ""),
    );
    if (
      candidateOutput === normalizedOutput &&
      Array.isArray(record.expression_roles) &&
      record.expression_roles.length > 0
    )
      matches.push(record);
    for (const key of ["expressions", "measures"]) visit(record[key]);
  };
  visit(value);
  if (matches.length === 0) return null;

  const fields = new Map<string, JsonRecord>();
  for (const match of matches) {
    const roles = Array.isArray(match.expression_roles)
      ? match.expression_roles
      : [];
    for (const rawRole of roles) {
      const role = asRecord(rawRole);
      const effects = Array.isArray(role?.effects)
        ? role.effects.map((effect) => normalizeName(String(effect)))
        : [];
      if (!effects.includes("value_contribution")) continue;
      const inputColumns = Array.isArray(role?.input_columns)
        ? role.input_columns
        : [];
      for (const rawInput of inputColumns) {
        const input = asRecord(rawInput);
        const physical = Array.isArray(input?.physical) ? input.physical : [];
        for (const rawField of physical) {
          const field = asRecord(rawField);
          const table = normalizeName(String(field?.table ?? ""));
          const column = normalizeName(String(field?.column ?? ""));
          if (!table || !column) continue;
          fields.set(`${table}.${column}`, { table, column });
        }
      }
    }
  }
  return [...fields.values()].sort((left, right) =>
    compareText(
      `${left.table}.${left.column}`,
      `${right.table}.${right.column}`,
    ),
  );
}

const dependencyIndexesCache = new WeakMap<
  object,
  FieldExpressionDependencyIndexes
>();

function dependencyIndexesFor(
  load: CurrentBundleLoad,
): FieldExpressionDependencyIndexes {
  const cached = dependencyIndexesCache.get(load);
  if (cached) return cached;
  const expressions = new Map<string, JsonRecord>();
  for (const expression of load.records["field-expression-nodes.jsonl"] ?? []) {
    const expressionId = String(expression.expression_id ?? "");
    if (expressionId && !expressions.has(expressionId))
      expressions.set(expressionId, expression);
  }
  const relations = new Map<string, JsonRecord>();
  for (const relation of load.records["relation-nodes.jsonl"] ?? []) {
    const relationId = String(relation.relation_id ?? "");
    if (relationId && !relations.has(relationId))
      relations.set(relationId, relation);
  }
  const valueInputFieldsByExpressionId = new Map<
    string,
    readonly JsonRecord[]
  >();
  for (const [expressionId, expression] of expressions) {
    const relation = relations.get(String(expression.relation_id ?? ""));
    const valueInputs = valueContributionInputFields(
      relation?.relation,
      String(expression.output_name ?? expression.output ?? ""),
    );
    if (valueInputs !== null)
      valueInputFieldsByExpressionId.set(expressionId, valueInputs);
  }
  const indexes = {
    expressions,
    relations,
    valueInputFieldsByExpressionId,
  };
  dependencyIndexesCache.set(load, indexes);
  return indexes;
}

export function fieldExpressionFor(
  load: CurrentBundleLoad,
  binding: JsonRecord,
): JsonRecord | null {
  return (
    dependencyIndexesFor(load).expressions.get(
      String(binding.expression_id ?? ""),
    ) ?? null
  );
}

export function expressionInputDependencyStatus(
  expression: JsonRecord,
): InputDependencyStatus | undefined {
  const status = String(expression.input_dependency_status ?? "");
  return INPUT_DEPENDENCY_STATUSES.has(status as InputDependencyStatus)
    ? (status as InputDependencyStatus)
    : undefined;
}

export function sourceFieldsForExpression(
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  load: CurrentBundleLoad,
  taskId: string,
  taskTarget: PhysicalTableCatalogEntry,
  defaultSchema: TaskDefaultSchema | null,
): FieldDependencySourceResult {
  const fields = new Map<string, PhysicalFieldIdentity>();
  const unresolved: { table: string; column: string; reason: string }[] = [];
  const indexedValueInputs = dependencyIndexesFor(
    load,
  ).valueInputFieldsByExpressionId.get(String(expression.expression_id ?? ""));
  const inputFields =
    indexedValueInputs ??
    (Array.isArray(expression.input_fields) ? expression.input_fields : []);
  for (const raw of inputFields) {
    const input = asRecord(raw);
    const rawTableName = normalizeName(String(input?.table ?? ""));
    const column = normalizeName(String(input?.column ?? ""));
    if (!rawTableName || !column) continue;
    const resolution = resolvePhysicalInputField(
      {
        catalog,
        taskId,
        defaultSchema,
        fallbackTable: taskTarget,
        schemaRefs: load.records["schema-refs.jsonl"] ?? [],
      },
      { table: rawTableName, column },
    );
    if (resolution.status === "UNRESOLVED") {
      unresolved.push({
        table: resolution.table,
        column,
        reason:
          resolution.reason === "TABLE_PACK_MISSING"
            ? "SOURCE_TABLE_PACK_MISSING"
            : resolution.reason === "TABLE_IDENTITY_AMBIGUOUS"
              ? "SOURCE_TABLE_IDENTITY_AMBIGUOUS"
              : "SOURCE_FIELD_NOT_IN_SCHEMA",
      });
      continue;
    }
    fields.set(physicalFieldKey(resolution.field), resolution.field);
  }
  return {
    fields: [...fields.values()].sort((left, right) =>
      compareText(physicalFieldKey(left), physicalFieldKey(right)),
    ),
    unresolved: unresolved.sort((left, right) =>
      compareText(
        `${left.table}.${left.column}`,
        `${right.table}.${right.column}`,
      ),
    ),
  };
}

function isZipperExistenceCase(text: string | null): boolean {
  return text !== null && /\bIS\s+NOT\s+NULL\b/i.test(text);
}

function branchSelectionInputFields(
  value: unknown,
  outputName: string,
): JsonRecord[] | null {
  const normalizedOutput = normalizeName(outputName);
  if (!normalizedOutput) return null;
  const matches: JsonRecord[] = [];
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    const record = asRecord(candidate);
    if (!record) return;
    const candidateOutput = normalizeName(
      String(record.output ?? record.output_name ?? ""),
    );
    if (
      candidateOutput === normalizedOutput &&
      Array.isArray(record.expression_roles) &&
      record.expression_roles.length > 0
    )
      matches.push(record);
    for (const key of ["expressions", "measures"]) visit(record[key]);
  };
  visit(value);
  if (matches.length === 0) return null;
  if (
    matches.some((match) =>
      isZipperExistenceCase(
        nonEmpty(match.expr_text) ??
          nonEmpty(match.expression_text) ??
          nonEmpty(match.display_text),
      ),
    )
  )
    return [];

  const fields = new Map<string, JsonRecord>();
  for (const match of matches) {
    const roles = Array.isArray(match.expression_roles)
      ? match.expression_roles
      : [];
    for (const rawRole of roles) {
      const role = asRecord(rawRole);
      const effects = Array.isArray(role?.effects)
        ? role.effects.map((effect) => normalizeName(String(effect)))
        : [];
      if (
        !effects.includes("branch_selection") ||
        effects.includes("value_contribution")
      )
        continue;
      const inputColumns = Array.isArray(role?.input_columns)
        ? role.input_columns
        : [];
      for (const rawInput of inputColumns) {
        const input = asRecord(rawInput);
        const physical = Array.isArray(input?.physical) ? input.physical : [];
        for (const rawField of physical) {
          const field = asRecord(rawField);
          const table = normalizeName(String(field?.table ?? ""));
          const column = normalizeName(String(field?.column ?? ""));
          if (!table || !column) continue;
          fields.set(`${table}.${column}`, { table, column });
        }
      }
    }
  }
  return [...fields.values()].sort((left, right) =>
    compareText(
      `${left.table}.${left.column}`,
      `${right.table}.${right.column}`,
    ),
  );
}

export function fieldConditionalsForNode(
  load: CurrentBundleLoad,
  node: FieldConditionalNode,
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  defaultSchema: TaskDefaultSchema | null,
  fallbackTable: Pick<PhysicalTableCatalogEntry, "platform" | "dataSource">,
  status: "CONFIRMED" | "PROVISIONAL_LEGACY",
): FieldConditionalAnnotation[] {
  if (isZipperExistenceCase(nonEmpty(expression.expression_text))) return [];
  const relation = dependencyIndexesFor(load).relations.get(
    String(expression.relation_id ?? ""),
  );
  const inputs = branchSelectionInputFields(
    relation?.relation,
    String(expression.output_name ?? expression.output ?? node.field.column),
  );
  if (!inputs || inputs.length === 0) return [];
  const fields = new Map<string, PhysicalFieldIdentity>();
  let unresolved = false;
  for (const pair of inputs) {
    const resolution = resolvePhysicalInputField(
      {
        catalog,
        taskId: node.taskId,
        defaultSchema,
        fallbackTable,
        schemaRefs: load.records["schema-refs.jsonl"] ?? [],
      },
      { table: String(pair.table), column: String(pair.column) },
    );
    if (resolution.status === "RESOLVED")
      fields.set(physicalFieldKey(resolution.field), resolution.field);
    else unresolved = true;
  }
  if (fields.size === 0 && !unresolved) return [];
  return [
    {
      conditionalId: `field-conditional:${node.nodeId}`,
      taskId: node.taskId,
      nodeId: node.nodeId,
      statementId: String(expression.statement_id ?? ""),
      relationId: nonEmpty(expression.relation_id),
      subtype: "CONDITIONAL",
      masking: false,
      fields: [...fields.values()],
      sourceText: nonEmpty(expression.expression_text),
      evidenceStatus: unresolved ? "UNRESOLVED" : status,
      reasonCode: unresolved ? "FIELD_CONDITIONAL_IDENTITY_UNRESOLVED" : null,
      evidenceRefs: [
        load.evidence["field-expression-nodes.jsonl"] ??
          "machine-facts:field-expression-nodes.jsonl",
      ],
    },
  ];
}

export function fieldConditionalsForExpression(
  load: CurrentBundleLoad,
  taskId: string,
  outputColumn: string,
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  defaultSchema: TaskDefaultSchema | null,
  fallbackTable: Pick<PhysicalTableCatalogEntry, "platform" | "dataSource">,
  status: "CONFIRMED" | "PROVISIONAL_LEGACY",
): FieldConditionalAnnotation[] {
  return fieldConditionalsForNode(
    load,
    {
      nodeId: `task-local:${taskId}:${outputColumn}`,
      taskId,
      field: { column: outputColumn },
    },
    expression,
    catalog,
    defaultSchema,
    fallbackTable,
    status,
  );
}

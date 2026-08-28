import type {
  DifferentialSchema,
  DifferentialSchemaColumn,
  DifferentialSchemaTable,
  DifferentialPhysicalTableIdentity,
} from "./protocol.ts";
import type { ConcreteSqlType } from "./plan-facts-rel-contract.ts";
import {
  parseDdlSchema,
  type DdlColumn,
  type ParsedDdlSchema,
} from "../plans/ddl-schema.ts";
import type { Column } from "../../src/qualify/schema.ts";
import type { SchemaProvider } from "../../src/qualify/schema-provider.ts";

/** The physical identity used by the differential schema, never a guessed name. */
export interface SchemaTableIdentity {
  readonly catalog?: string;
  readonly schema?: string;
  readonly name: string;
}

/** A typed schema fact. DdlColumn is also accepted, but cannot provide nullable by itself. */
export interface SchemaColumnEvidence
  extends Pick<Column, "name" | "type" | "nullable"> {
  readonly ordinal?: number;
  readonly evidenceRefs?: readonly string[];
}

export type SchemaColumnSource = SchemaColumnEvidence | DdlColumn;

/**
 * One requested table. The `table`/`identity` forms are convenient when the
 * caller keeps identity separate from its evidence; direct identity fields are
 * accepted so a provider-backed request stays small.
 */
export interface SchemaTableProjectionInput {
  readonly table?: SchemaTableIdentity;
  readonly identity?: SchemaTableIdentity;
  readonly catalog?: string;
  readonly schema?: string;
  readonly name?: string;
  readonly columns?: readonly SchemaColumnSource[];
  readonly ddl?: string | ParsedDdlSchema;
  readonly evidenceRefs?: readonly string[];
  /** Evidence refs for provider-returned columns when Column itself has none. */
  readonly columnEvidenceRefs?: Readonly<Record<string, readonly string[]>>;
  /** Exact physical catalog identity; never synthesized from SQL names. */
  readonly physicalTableIdentity?: DifferentialPhysicalTableIdentity;
}

export interface SchemaTypeProjectionInput {
  readonly tables: readonly SchemaTableProjectionInput[];
  readonly provider?: SchemaProvider;
  readonly schemaProvider?: SchemaProvider;
  /** Alias for callers that use `schema` for their SchemaProvider. */
  readonly schema?: SchemaProvider;
  readonly dialect?: string;
}

export interface SchemaTypeProjectionContext {
  readonly table?: SchemaTableIdentity;
  readonly columnName?: string;
  readonly path?: string;
  readonly evidenceRefs?: readonly string[];
  readonly dialect?: string;
}

export type SchemaTypeProjectionIssueCode =
  | "SCHEMA_TABLE_IDENTITY_INVALID"
  | "SCHEMA_TABLE_AMBIGUOUS"
  | "SCHEMA_TABLE_MISSING"
  | "SCHEMA_EVIDENCE_MISSING"
  | "SCHEMA_COLUMNS_MISSING"
  | "SCHEMA_COLUMNS_INVALID"
  | "SCHEMA_COLUMN_IDENTITY_INVALID"
  | "SCHEMA_COLUMN_IDENTITY_DUPLICATE"
  | "SCHEMA_COLUMN_ORDINAL_INVALID"
  | "SCHEMA_COLUMN_ORDINAL_AMBIGUOUS"
  | "SCHEMA_COLUMN_ORDINAL_NONCONTIGUOUS"
  | "SCHEMA_LOOKUP_FAILED"
  | "SCHEMA_TYPE_MISSING"
  | "SCHEMA_TYPE_NOT_CONCRETE"
  | "SCHEMA_TYPE_UNSUPPORTED"
  | "SCHEMA_TYPE_AMBIGUOUS"
  | "SCHEMA_NULLABILITY_MISSING"
  | "SCHEMA_NULLABILITY_AMBIGUOUS";

/** A failure is tied to the table/column and carries only supplied evidence refs. */
export interface SchemaTypeProjectionIssue {
  readonly code: SchemaTypeProjectionIssueCode;
  readonly message: string;
  readonly path: string;
  readonly table?: SchemaTableIdentity;
  readonly columnName?: string;
  readonly candidates?: readonly SchemaTableIdentity[];
  readonly evidenceRefs: readonly string[];
}

export interface ConcreteSqlTypeProjectionResult {
  readonly status: "SUCCESS" | "UNSUPPORTED";
  readonly type: ConcreteSqlType | null;
  readonly issues: readonly SchemaTypeProjectionIssue[];
}

export interface SchemaTypeFact {
  readonly table: SchemaTableIdentity;
  readonly column: {
    readonly name: string;
    readonly ordinal: number;
  };
  readonly type: ConcreteSqlType;
  readonly evidenceRefs: readonly string[];
  readonly physicalTableIdentity?: DifferentialPhysicalTableIdentity;
}

export interface SchemaTypeProjectionResult {
  readonly status: "SUCCESS" | "PARTIAL" | "UNSUPPORTED";
  readonly schema: DifferentialSchema | null;
  readonly types: readonly SchemaTypeFact[];
  readonly issues: readonly SchemaTypeProjectionIssue[];
}

type TypeSource = {
  readonly type?: string;
  readonly nullable?: boolean;
};

type ParsedType = {
  readonly name: string;
  readonly precision?: number;
  readonly scale?: number;
  readonly nullableFromDdl?: boolean;
};

const TYPE_ALIASES: ReadonlyMap<string, string> = new Map([
  ["TINYINT", "TINYINT"],
  ["SMALLINT", "SMALLINT"],
  ["INT", "INTEGER"],
  ["INTEGER", "INTEGER"],
  ["BIGINT", "BIGINT"],
  ["FLOAT", "FLOAT"],
  ["REAL", "REAL"],
  ["DOUBLE", "DOUBLE"],
  ["BOOLEAN", "BOOLEAN"],
  ["BOOL", "BOOLEAN"],
  ["STRING", "VARCHAR"],
  ["VARCHAR", "VARCHAR"],
  ["CHAR", "CHAR"],
  ["BINARY", "VARBINARY"],
  ["VARBINARY", "VARBINARY"],
  ["DATE", "DATE"],
  ["TIME", "TIME"],
  ["TIMESTAMP", "TIMESTAMP"],
  ["DECIMAL", "DECIMAL"],
  ["NUMERIC", "DECIMAL"],
  ["NUMBER", "DECIMAL"],
]);

const PARAMETERIZED_TYPES = new Set([
  "CHAR",
  "VARCHAR",
  "VARBINARY",
  "DECIMAL",
  "TIMESTAMP",
]);

function copyRefs(value: readonly string[] | undefined): readonly string[] {
  return value === undefined ? [] : [...value];
}

function typeContextPath(context: SchemaTypeProjectionContext | undefined): string {
  return context?.path ?? "column";
}

function makeIssue(
  code: SchemaTypeProjectionIssueCode,
  message: string,
  context: SchemaTypeProjectionContext | undefined,
  path = typeContextPath(context),
  candidates?: readonly SchemaTableIdentity[],
): SchemaTypeProjectionIssue {
  return {
    code,
    message,
    path,
    ...(context?.table ? { table: context.table } : {}),
    ...(context?.columnName ? { columnName: context.columnName } : {}),
    ...(candidates ? { candidates } : {}),
    evidenceRefs: copyRefs(context?.evidenceRefs),
  };
}

function readQuotedEnd(text: string, start: number): number | undefined {
  const quote = text[start];
  if (quote !== "'" && quote !== '"' && quote !== "`") return undefined;
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] !== quote) continue;
    if (text[index + 1] === quote) {
      index += 1;
      continue;
    }
    return index + 1;
  }
  return undefined;
}

function matchingParenthesis(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const current = text[index]!;
    if (current === "'" || current === '"' || current === "`") {
      const end = readQuotedEnd(text, index);
      if (end === undefined) return -1;
      index = end - 1;
      continue;
    }
    if (current === "(") depth += 1;
    else if (current === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTypeParameters(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let parentheses = 0;
  let angles = 0;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index]!;
    if (current === "'" || current === '"' || current === "`") {
      const end = readQuotedEnd(text, index);
      if (end === undefined) return [text];
      index = end - 1;
      continue;
    }
    if (current === "(") parentheses += 1;
    else if (current === ")") parentheses -= 1;
    else if (current === "<") angles += 1;
    else if (current === ">" && angles > 0) angles -= 1;
    else if (current === "," && parentheses === 0 && angles === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function setNullableEvidence(
  current: boolean | undefined,
  next: boolean,
): { readonly nullable?: boolean; readonly conflict: boolean } {
  if (current !== undefined && current !== next)
    return { nullable: current, conflict: true };
  return { nullable: next, conflict: false };
}

/** Consume only known DDL annotations; arbitrary suffixes are not type evidence. */
function parseDdlSuffix(
  value: string,
  canonicalName: string,
): {
  readonly nullable?: boolean;
  readonly ambiguous: boolean;
} {
  let rest = value.trim();
  let nullable: boolean | undefined;
  while (rest) {
    const notNull = /^not\s+null\b/i.exec(rest);
    if (notNull) {
      const next = setNullableEvidence(nullable, false);
      if (next.conflict) return { nullable, ambiguous: true };
      nullable = next.nullable;
      rest = rest.slice(notNull[0].length).trim();
      continue;
    }
    const nullability = /^null\b/i.exec(rest);
    if (nullability) {
      const next = setNullableEvidence(nullable, true);
      if (next.conflict) return { nullable, ambiguous: true };
      nullable = next.nullable;
      rest = rest.slice(nullability[0].length).trim();
      continue;
    }
    const comment = /^comment\s*/i.exec(rest);
    if (comment) {
      const commentStart = comment[0].length;
      const commentEnd = readQuotedEnd(rest, commentStart);
      if (commentEnd === undefined) return { nullable, ambiguous: true };
      rest = rest.slice(commentEnd).trim();
      continue;
    }
    if (canonicalName === "DOUBLE" && /^precision\b/i.test(rest)) {
      rest = rest.replace(/^precision\b/i, "").trim();
      continue;
    }
    // These clauses describe a DDL column, not its SQL type. They do not
    // supply nullability, so accepting them cannot create a type inference.
    if (/^(?:default|primary\s+key|unique|references|check|generated)\b/i.test(rest))
      return { nullable, ambiguous: true };
    return { nullable, ambiguous: true };
  }
  return { nullable, ambiguous: false };
}

function parseTypeText(
  raw: unknown,
  context: SchemaTypeProjectionContext | undefined,
): { readonly parsed?: ParsedType; readonly issues: readonly SchemaTypeProjectionIssue[] } {
  if (typeof raw !== "string" || raw.trim() === "")
    return {
      issues: [
        makeIssue(
          "SCHEMA_TYPE_MISSING",
          "Column type evidence is required; a column name or expression cannot supply it.",
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };

  const text = raw.trim();
  const nameMatch = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(text);
  if (!nameMatch)
    return {
      issues: [
        makeIssue(
          "SCHEMA_TYPE_AMBIGUOUS",
          `Column type evidence is not a concrete SQL type: ${raw}.`,
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };

  const rawName = nameMatch[0]!.toUpperCase();
  if (
    rawName === "STRING" &&
    context?.dialect?.trim().toUpperCase() !== "HIVE"
  ) {
    return {
      issues: [
        makeIssue(
          "SCHEMA_TYPE_UNSUPPORTED",
          "Hive STRING is accepted only for trusted Hive schema evidence.",
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };
  }
  const canonicalName = TYPE_ALIASES.get(rawName);
  if (!canonicalName) {
    const code = rawName === "ANY" || rawName === "UNKNOWN"
      ? "SCHEMA_TYPE_NOT_CONCRETE"
      : "SCHEMA_TYPE_UNSUPPORTED";
    return {
      issues: [
        makeIssue(
          code,
          rawName === "ANY" || rawName === "UNKNOWN"
            ? "ANY and UNKNOWN are forbidden because Calcite metadata requires a concrete type."
            : `SQL type ${rawName} is outside the bounded Calcite projection matrix.`,
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };
  }

  let index = nameMatch[0]!.length;
  while (/\s/.test(text[index] ?? "")) index += 1;
  let parameters: string[] | undefined;
  if (text[index] === "(") {
    const close = matchingParenthesis(text, index);
    if (close < 0)
      return {
        issues: [
          makeIssue(
            "SCHEMA_TYPE_AMBIGUOUS",
            "SQL type parameters are unbalanced and cannot be projected safely.",
            context,
            `${typeContextPath(context)}.type`,
          ),
        ],
      };
    parameters = splitTypeParameters(text.slice(index + 1, close));
    index = close + 1;
  }

  if (parameters && !PARAMETERIZED_TYPES.has(canonicalName))
    return {
      issues: [
        makeIssue(
          "SCHEMA_TYPE_AMBIGUOUS",
          `Parameters are not supported for SQL type ${canonicalName}.`,
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };

  let precision: number | undefined;
  let scale: number | undefined;
  if (parameters) {
    const values = parameters.map((parameter) => parameter.trim());
    const integers = values.map((parameter) =>
      /^\d+$/.test(parameter) ? Number(parameter) : Number.NaN,
    );
    if (
      integers.some((value) => !Number.isSafeInteger(value)) ||
      values.length === 0 ||
      (canonicalName === "DECIMAL" && values.length > 2) ||
      (canonicalName !== "DECIMAL" && values.length !== 1)
    )
      return {
        issues: [
          makeIssue(
            "SCHEMA_TYPE_AMBIGUOUS",
            `SQL type parameters for ${canonicalName} are missing or ambiguous.`,
            context,
            `${typeContextPath(context)}.type`,
          ),
        ],
      };
    precision = integers[0];
    if (canonicalName === "DECIMAL" && values.length === 2) scale = integers[1];
    if (
      precision === undefined ||
      precision <= 0 ||
      (scale !== undefined && (scale < 0 || scale > precision))
    )
      return {
        issues: [
          makeIssue(
            "SCHEMA_TYPE_AMBIGUOUS",
            `SQL type parameters for ${canonicalName} are outside the concrete range.`,
            context,
            `${typeContextPath(context)}.type`,
          ),
        ],
      };
  }

  const suffix = parseDdlSuffix(text.slice(index), canonicalName);
  if (suffix.ambiguous)
    return {
      issues: [
        makeIssue(
          "SCHEMA_TYPE_AMBIGUOUS",
          "Trailing type text is not a recognized DDL annotation; it cannot be treated as type evidence.",
          context,
          `${typeContextPath(context)}.type`,
        ),
      ],
    };

  return {
    parsed: {
      name: canonicalName,
      ...(precision === undefined ? {} : { precision }),
      ...(scale === undefined ? {} : { scale }),
      ...(suffix.nullable === undefined
        ? {}
        : { nullableFromDdl: suffix.nullable }),
    },
    issues: [],
  };
}

/**
 * Project one schema column's explicit type and nullability into the
 * Calcite-facing concrete type contract. This function intentionally accepts
 * no expression text and never consults the column name for a fallback.
 */
export function projectConcreteSqlType(
  source: TypeSource | string | undefined,
  nullableOrContext?: boolean | SchemaTypeProjectionContext,
  context?: SchemaTypeProjectionContext,
): ConcreteSqlTypeProjectionResult {
  let rawType: unknown;
  let rawNullable: unknown;
  let resolvedContext = context;
  if (typeof source === "string" || source === undefined) {
    rawType = source;
    rawNullable = typeof nullableOrContext === "boolean" ? nullableOrContext : undefined;
    if (typeof nullableOrContext === "object") resolvedContext = nullableOrContext;
  } else {
    rawType = source.type;
    if (
      typeof nullableOrContext === "boolean" &&
      typeof source.nullable === "boolean" &&
      nullableOrContext !== source.nullable
    ) {
      const conflictContext = context;
      return {
        status: "UNSUPPORTED",
        type: null,
        issues: [
          makeIssue(
            "SCHEMA_NULLABILITY_AMBIGUOUS",
            "Schema nullability sources disagree; no override is applied silently.",
            conflictContext,
            `${typeContextPath(conflictContext)}.nullable`,
          ),
        ],
      };
    }
    rawNullable =
      typeof nullableOrContext === "boolean"
        ? nullableOrContext
        : source.nullable;
    if (typeof nullableOrContext === "object") resolvedContext = nullableOrContext;
  }

  const parsed = parseTypeText(rawType, resolvedContext);
  const issues = [...parsed.issues];
  const ddlNullable = parsed.parsed?.nullableFromDdl;
  if (typeof rawNullable !== "boolean" && ddlNullable === undefined)
    issues.push(
      makeIssue(
        "SCHEMA_NULLABILITY_MISSING",
        "Column nullability must be explicit; it cannot be inferred from a name or expression.",
        resolvedContext,
        `${typeContextPath(resolvedContext)}.nullable`,
      ),
    );
  if (
    typeof rawNullable === "boolean" &&
    ddlNullable !== undefined &&
    rawNullable !== ddlNullable
  )
    issues.push(
      makeIssue(
        "SCHEMA_NULLABILITY_AMBIGUOUS",
        "Schema nullability conflicts with the explicit DDL nullability clause.",
        resolvedContext,
        `${typeContextPath(resolvedContext)}.nullable`,
      ),
    );

  if (issues.length > 0 || !parsed.parsed) return { status: "UNSUPPORTED", type: null, issues };
  const nullable = typeof rawNullable === "boolean" ? rawNullable : ddlNullable;
  if (nullable === undefined)
    return {
      status: "UNSUPPORTED",
      type: null,
      issues: [
        makeIssue(
          "SCHEMA_NULLABILITY_MISSING",
          "Column nullability must be explicit; it cannot be inferred from a name or expression.",
          resolvedContext,
          `${typeContextPath(resolvedContext)}.nullable`,
        ),
      ],
    };
  return {
    status: "SUCCESS",
    type: {
      status: "CONCRETE",
      name: parsed.parsed.name,
      nullable,
      ...(parsed.parsed.precision === undefined
        ? {}
        : { precision: parsed.parsed.precision }),
      ...(parsed.parsed.scale === undefined ? {} : { scale: parsed.parsed.scale }),
    },
    issues: [],
  };
}

function concreteTypeText(type: ConcreteSqlType): string {
  if (type.precision === undefined) return type.name;
  if (type.scale === undefined) return `${type.name}(${type.precision})`;
  return `${type.name}(${type.precision},${type.scale})`;
}

function identityFromParts(parts: readonly string[]): SchemaTableIdentity | undefined {
  if (parts.length === 1 && parts[0]) return { name: parts[0] };
  if (parts.length === 2 && parts[0] && parts[1])
    return { schema: parts[0], name: parts[1] };
  if (parts.length === 3 && parts[0] && parts[1] && parts[2])
    return { catalog: parts[0], schema: parts[1], name: parts[2] };
  return undefined;
}

function tableIdentityOf(input: SchemaTableProjectionInput): SchemaTableIdentity | undefined {
  const candidates = [
    input.table,
    input.identity,
    input.name === undefined
      ? undefined
      : {
      ...(input.catalog === undefined ? {} : { catalog: input.catalog }),
      ...(input.schema === undefined ? {} : { schema: input.schema }),
      name: input.name,
    },
  ].filter((value): value is SchemaTableIdentity => value !== undefined);
  if (candidates.length === 0) return undefined;
  const first = identityKey(candidates[0]!);
  return candidates.every((candidate) => identityKey(candidate) === first)
    ? candidates[0]
    : undefined;
}

function tableParts(identity: SchemaTableIdentity): string[] {
  return [identity.catalog, identity.schema, identity.name].filter(
    (part): part is string => part !== undefined,
  );
}

function identityKey(identity: SchemaTableIdentity): string {
  return tableParts(identity).map((part) => part.toLowerCase()).join("\u0000");
}

function validTableIdentity(identity: SchemaTableIdentity | undefined): boolean {
  if (!identity || typeof identity.name !== "string" || identity.name.trim() === "")
    return false;
  return [identity.catalog, identity.schema].every(
    (part) => part === undefined || (typeof part === "string" && part.trim() !== ""),
  );
}

function sourceEvidenceRefs(
  table: SchemaTableProjectionInput,
  column: SchemaColumnSource,
): readonly string[] | undefined {
  const direct = (column as SchemaColumnEvidence).evidenceRefs;
  if (direct !== undefined) return copyRefs(direct);
  const mapped = table.columnEvidenceRefs?.[column.name];
  if (mapped !== undefined) return copyRefs(mapped);
  if (table.evidenceRefs !== undefined) return copyRefs(table.evidenceRefs);
  return undefined;
}

function normalizeProjectionInput(
  inputOrProvider:
    | SchemaTypeProjectionInput
    | readonly SchemaTableProjectionInput[]
    | SchemaProvider,
  tablesOrProvider?: readonly SchemaTableProjectionInput[] | SchemaProvider,
  dialect?: string,
): SchemaTypeProjectionInput {
  if (Array.isArray(inputOrProvider)) {
    const provider =
      tablesOrProvider &&
      !Array.isArray(tablesOrProvider) &&
      "columnsFor" in tablesOrProvider
        ? tablesOrProvider
        : undefined;
    return {
      tables: inputOrProvider as readonly SchemaTableProjectionInput[],
      ...(provider ? { provider } : {}),
      ...(dialect === undefined ? {} : { dialect }),
    };
  }
  if (
    typeof inputOrProvider === "object" &&
    inputOrProvider !== null &&
    "columnsFor" in inputOrProvider &&
    Array.isArray(tablesOrProvider)
  )
    return {
      tables: tablesOrProvider,
      provider: inputOrProvider,
      ...(dialect === undefined ? {} : { dialect }),
    };
  return inputOrProvider as SchemaTypeProjectionInput;
}

function hiveDdlDefaultsNullable(dialect: string | undefined): boolean {
  return dialect?.trim().toUpperCase() === "HIVE";
}

function ddlDeclaresNullability(type: unknown): boolean {
  return parseTypeText(type, undefined).parsed?.nullableFromDdl !== undefined;
}

function candidatesToIdentities(
  candidates: readonly string[][],
): readonly SchemaTableIdentity[] {
  return candidates.flatMap((candidate) => {
    const identity = identityFromParts(candidate);
    return identity ? [identity] : [];
  });
}

export function projectDifferentialSchema(
  input: SchemaTypeProjectionInput,
): SchemaTypeProjectionResult;
export function projectDifferentialSchema(
  tables: readonly SchemaTableProjectionInput[],
  provider?: SchemaProvider,
  dialect?: string,
): SchemaTypeProjectionResult;
export function projectDifferentialSchema(
  provider: SchemaProvider,
  tables: readonly SchemaTableProjectionInput[],
  dialect?: string,
): SchemaTypeProjectionResult;
export function projectDifferentialSchema(
  inputOrProvider:
    | SchemaTypeProjectionInput
    | readonly SchemaTableProjectionInput[]
    | SchemaProvider,
  tablesOrProvider?: readonly SchemaTableProjectionInput[] | SchemaProvider,
  dialect?: string,
): SchemaTypeProjectionResult {
  const input = normalizeProjectionInput(inputOrProvider, tablesOrProvider, dialect);
  const providers = [input.provider, input.schemaProvider, input.schema].filter(
    (value): value is SchemaProvider => value !== undefined,
  );
  const provider = providers[0];
  const issues: SchemaTypeProjectionIssue[] = [];
  const schemaTables: DifferentialSchemaTable[] = [];
  const types: SchemaTypeFact[] = [];
  const seenTables = new Set<string>();

  if (providers.some((candidate) => candidate !== provider)) {
    issues.push(makeIssue(
      "SCHEMA_LOOKUP_FAILED",
      "Conflicting SchemaProvider aliases were supplied; use one canonical provider.",
      { path: "provider", evidenceRefs: [] },
      "provider",
    ));
    return { status: "UNSUPPORTED", schema: null, types: [], issues };
  }

  input.tables.forEach((tableInput, tableIndex) => {
    const requestedIdentity = tableIdentityOf(tableInput);
    const tablePath = `tables[${tableIndex}]`;
    const tableRefs = copyRefs(tableInput.evidenceRefs);
    if (!validTableIdentity(requestedIdentity)) {
      issues.push(
        makeIssue(
          "SCHEMA_TABLE_IDENTITY_INVALID",
          "A schema table requires an exact non-empty table identity.",
          { path: tablePath, evidenceRefs: tableRefs },
          `${tablePath}.table`,
        ),
      );
      return;
    }

    let resolvedIdentity = requestedIdentity!;
    let columns: readonly SchemaColumnSource[] | undefined = tableInput.columns;
    let columnsFromDdl = false;
    if (provider) {
      const requestedParts = tableParts(resolvedIdentity);
      let candidates: readonly string[][] | undefined;
      try {
        candidates = provider.tableCandidates?.(requestedParts, input.dialect);
      } catch (error) {
        issues.push(makeIssue("SCHEMA_LOOKUP_FAILED", error instanceof Error ? error.message : String(error), { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs }, `${tablePath}.table`));
        return;
      }
      if (candidates && candidates.length > 1) {
        issues.push(makeIssue("SCHEMA_TABLE_AMBIGUOUS", `Table reference has ${candidates.length} suffix candidates; an exact physical table is required.`, { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs }, `${tablePath}.table`, candidatesToIdentities(candidates)));
        return;
      }
      if (candidates && candidates.length === 1) {
        const candidateIdentity = identityFromParts(candidates[0]!);
        if (!candidateIdentity) {
          issues.push(makeIssue("SCHEMA_TABLE_IDENTITY_INVALID", "The provider returned a table identity that cannot be represented exactly.", { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs }, `${tablePath}.table`));
          return;
        }
        resolvedIdentity = candidateIdentity;
      }
    }
    if (columns === undefined && tableInput.ddl !== undefined) {
      try {
        const parsed =
          typeof tableInput.ddl === "string"
            ? parseDdlSchema(tableInput.ddl)
            : tableInput.ddl;
        if (parsed.warnings.length > 0) {
          issues.push(makeIssue("SCHEMA_COLUMNS_INVALID", `DDL schema is incomplete: ${parsed.warnings.join("; ")}.`, { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs }, `${tablePath}.ddl`));
          return;
        }
        columns = parsed.columns;
        columnsFromDdl = true;
      } catch (error) {
        issues.push(
          makeIssue(
            "SCHEMA_COLUMNS_INVALID",
            error instanceof Error ? error.message : String(error),
            { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
            `${tablePath}.ddl`,
          ),
        );
        return;
      }
    }

    if (columns === undefined && provider) {
      const requestedParts = tableParts(resolvedIdentity);
      try {
        columns = provider.columnsFor(tableParts(resolvedIdentity), input.dialect);
      } catch (error) {
        issues.push(
          makeIssue(
            "SCHEMA_LOOKUP_FAILED",
            error instanceof Error ? error.message : String(error),
            { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
            `${tablePath}.table`,
          ),
        );
        return;
      }
      if (columns === undefined) {
        issues.push(
          makeIssue(
            "SCHEMA_TABLE_MISSING",
            "The schema provider has no exact schema for this table.",
            { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
            `${tablePath}.table`,
            undefined,
          ),
        );
        return;
      }
    }

    if (columns === undefined) {
      issues.push(
        makeIssue(
          "SCHEMA_EVIDENCE_MISSING",
          "No typed schema or DDL evidence was supplied for this table.",
          { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
          `${tablePath}.columns`,
        ),
      );
      return;
    }
    if (columns.length === 0) {
      issues.push(
        makeIssue(
          "SCHEMA_COLUMNS_MISSING",
          "At least one schema column is required to construct a Calcite table schema.",
          { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
          `${tablePath}.columns`,
        ),
      );
      return;
    }

    const key = identityKey(resolvedIdentity);
    if (seenTables.has(key)) {
      issues.push(
        makeIssue(
          "SCHEMA_COLUMN_IDENTITY_DUPLICATE",
          "The same exact table identity was supplied more than once.",
          { table: resolvedIdentity, path: tablePath, evidenceRefs: tableRefs },
          `${tablePath}.table`,
        ),
      );
      return;
    }
    seenTables.add(key);

    const projectedColumns: DifferentialSchemaColumn[] = [];
    const tableTypes: SchemaTypeFact[] = [];
    const columnNames = new Set<string>();
    const ordinals = new Set<number>();
    let tableUnsupported = false;

    columns.forEach((column, columnIndex) => {
      const columnPath = `${tablePath}.columns[${columnIndex}]`;
      const columnRefs = sourceEvidenceRefs(tableInput, column);
      const columnContext: SchemaTypeProjectionContext = {
        table: resolvedIdentity,
        ...(typeof column.name === "string" ? { columnName: column.name } : {}),
        path: columnPath,
        evidenceRefs: columnRefs ?? tableRefs,
        dialect: input.dialect,
      };
      if (typeof column.name !== "string" || column.name.trim() === "") {
        issues.push(
          makeIssue(
            "SCHEMA_COLUMN_IDENTITY_INVALID",
            "A schema column requires an exact non-empty column identity.",
            columnContext,
            `${columnPath}.name`,
          ),
        );
        tableUnsupported = true;
        return;
      }
      const nameKey = column.name.toLowerCase();
      if (columnNames.has(nameKey)) {
        issues.push(
          makeIssue(
            "SCHEMA_COLUMN_IDENTITY_DUPLICATE",
            `Column identity ${column.name} is duplicated within the table.`,
            columnContext,
            `${columnPath}.name`,
          ),
        );
        tableUnsupported = true;
        return;
      }
      columnNames.add(nameKey);

      const suppliedOrdinal = (column as SchemaColumnEvidence).ordinal;
      const ordinal = suppliedOrdinal ?? columnIndex;
      if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
        issues.push(
          makeIssue(
            "SCHEMA_COLUMN_ORDINAL_INVALID",
            "Column ordinal must be a non-negative safe integer.",
            columnContext,
            `${columnPath}.ordinal`,
          ),
        );
        tableUnsupported = true;
        return;
      }
      if (ordinals.has(ordinal)) {
        issues.push(
          makeIssue(
            "SCHEMA_COLUMN_ORDINAL_AMBIGUOUS",
            `Column ordinal ${ordinal} is assigned to more than one column.`,
            columnContext,
            `${columnPath}.ordinal`,
          ),
        );
        tableUnsupported = true;
        return;
      }
      ordinals.add(ordinal);

      const typeSource =
        columnsFromDdl &&
        hiveDdlDefaultsNullable(input.dialect) &&
        (column as SchemaColumnEvidence).nullable === undefined &&
        !ddlDeclaresNullability(column.type)
          ? { ...column, nullable: true }
          : column;
      const typeResult = projectConcreteSqlType(typeSource, columnContext);
      if (typeResult.status !== "SUCCESS" || !typeResult.type) {
        issues.push(...typeResult.issues);
        tableUnsupported = true;
        return;
      }
      const evidenceRefs = copyRefs(columnRefs ?? tableRefs);
      projectedColumns.push({
        name: column.name,
        type: concreteTypeText(typeResult.type),
        nullable: typeResult.type.nullable,
        ordinal,
        ...(columnRefs === undefined && tableInput.evidenceRefs === undefined
          ? {}
          : { evidenceRefs }),
      });
      tableTypes.push({
        table: resolvedIdentity,
        column: { name: column.name, ordinal },
        type: typeResult.type,
        evidenceRefs,
        ...(tableInput.physicalTableIdentity === undefined
          ? {}
          : { physicalTableIdentity: tableInput.physicalTableIdentity }),
      });
    });

    if (tableUnsupported) return;
    const sortedColumns = [...projectedColumns].sort(
      (left, right) => left.ordinal! - right.ordinal!,
    );
    const sortedTypes = [...tableTypes].sort(
      (left, right) => left.column.ordinal - right.column.ordinal,
    );
    const firstNoncontiguousIndex = sortedColumns.findIndex(
      (column, expectedOrdinal) => column.ordinal !== expectedOrdinal,
    );
    if (firstNoncontiguousIndex >= 0) {
      const offendingColumn = sortedColumns[firstNoncontiguousIndex];
      issues.push(
        makeIssue(
          "SCHEMA_COLUMN_ORDINAL_NONCONTIGUOUS",
          "Column ordinals must form a contiguous zero-based sequence so Calcite field positions are exact.",
          {
            table: resolvedIdentity,
            ...(offendingColumn === undefined
              ? {}
              : { columnName: offendingColumn.name }),
            path: tablePath,
            evidenceRefs: tableRefs,
          },
          `${tablePath}.columns`,
        ),
      );
      return;
    }
    schemaTables.push({
      ...(resolvedIdentity.catalog === undefined
        ? {}
        : { catalog: resolvedIdentity.catalog }),
      ...(resolvedIdentity.schema === undefined
        ? {}
        : { schema: resolvedIdentity.schema }),
      name: resolvedIdentity.name,
      columns: sortedColumns,
      ...(tableInput.evidenceRefs === undefined
        ? {}
        : { evidenceRefs: tableRefs }),
      ...(tableInput.physicalTableIdentity === undefined
        ? {}
        : { physicalTableIdentity: tableInput.physicalTableIdentity }),
    });
    types.push(...sortedTypes);
  });

  const schema =
    input.tables.length === 0 || schemaTables.length > 0
      ? { tables: schemaTables }
      : null;
  return {
    status:
      issues.length === 0
        ? "SUCCESS"
        : schemaTables.length > 0
          ? "PARTIAL"
          : "UNSUPPORTED",
    schema,
    types,
    issues,
  };
}

/** Readable aliases for callers that name the operation after its two outputs. */
export const projectSchemaTypes = projectDifferentialSchema;
export const projectSchemaAndTypes = projectDifferentialSchema;

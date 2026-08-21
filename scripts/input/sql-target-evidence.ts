export type SqlTargetSlot =
  "create" | "query" | "prepare" | "truncate" | "finish";

export interface SqlTargetEvidence {
  readonly qualifiedName: string;
  readonly slot: SqlTargetSlot;
  readonly statementKind: "CREATE_TABLE" | "INSERT_TABLE" | "TRUNCATE_TABLE";
}

const TARGET_PATTERNS: readonly {
  readonly statementKind: SqlTargetEvidence["statementKind"];
  readonly pattern: RegExp;
}[] = [
  {
    statementKind: "INSERT_TABLE",
    pattern:
      /\binsert\s+(?:overwrite|into)\s+table\s+((?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*))?)/gi,
  },
  {
    statementKind: "CREATE_TABLE",
    pattern:
      /\bcreate\s+(?:external\s+)?table\s+(?:if\s+not\s+exists\s+)?((?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*))?)/gi,
  },
  {
    statementKind: "TRUNCATE_TABLE",
    pattern:
      /\btruncate\s+table\s+((?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*)(?:\s*\.\s*(?:`[^`]+`|"[^"]+"|[A-Za-z_][A-Za-z0-9_$#-]*))?)/gi,
  },
];

function maskCommentsAndStringLiterals(sql: string): string {
  const output = [...sql];
  let state: "normal" | "singleQuote" | "lineComment" | "blockComment" =
    "normal";
  for (let index = 0; index < output.length; index += 1) {
    const current = sql[index]!;
    const next = sql[index + 1];
    if (state === "normal") {
      if (current === "'") {
        output[index] = " ";
        state = "singleQuote";
      } else if (current === "-" && next === "-") {
        output[index] = " ";
        output[index + 1] = " ";
        index += 1;
        state = "lineComment";
      } else if (current === "/" && next === "*") {
        output[index] = " ";
        output[index + 1] = " ";
        index += 1;
        state = "blockComment";
      }
      continue;
    }
    if (state === "singleQuote") {
      if (current === "\n" || current === "\r") {
        continue;
      }
      output[index] = " ";
      if (current === "\\" && index + 1 < output.length) {
        output[index + 1] = " ";
        index += 1;
      } else if (current === "'" && next === "'") {
        output[index + 1] = " ";
        index += 1;
      } else if (current === "'") {
        state = "normal";
      }
      continue;
    }
    if (state === "lineComment") {
      if (current === "\n" || current === "\r") state = "normal";
      else output[index] = " ";
      continue;
    }
    if (current === "*" && next === "/") {
      output[index] = " ";
      output[index + 1] = " ";
      index += 1;
      state = "normal";
    } else if (current !== "\n" && current !== "\r") {
      output[index] = " ";
    }
  }
  return output.join("");
}

function normalizeQualifiedName(token: string): string | undefined {
  const parts = token
    .split(".")
    .map((part) => part.trim().replace(/^([`"])(.*)\1$/, "$2"));
  if (parts.some((part) => part === "" || part.includes("@"))) return undefined;
  if (parts.length !== 1 && parts.length !== 2) return undefined;
  return parts.join(".");
}

function taskNameBaseTable(taskName: string): string | undefined {
  const separator = taskName.indexOf(".");
  if (separator <= 0 || separator === taskName.length - 1) return undefined;
  const schema = taskName.slice(0, separator).trim();
  const table = taskName
    .slice(separator + 1)
    .trim()
    .replace(/_TIT\d+(?:_h\d+)?$/i, "");
  return schema !== "" && table !== "" ? `${schema}.${table}` : undefined;
}

function qualifyUnqualifiedTarget(
  target: string,
  taskName: string | undefined,
  allowSchemaOnlyQualification: boolean,
): string | undefined {
  if (target.includes(".")) return target;
  if (taskName === undefined) return undefined;
  const taskTable = taskNameBaseTable(taskName);
  if (taskTable === undefined) return undefined;
  const separator = taskTable.indexOf(".");
  const taskTableName = taskTable.slice(separator + 1);
  const normalizedTarget = target.toLowerCase();
  const normalizedTaskTable = taskTableName.toLowerCase();
  if (normalizedTaskTable !== normalizedTarget && !allowSchemaOnlyQualification)
    return undefined;
  return `${taskTable.slice(0, separator)}.${target}`;
}

/**
 * Finds an unambiguous SQL-declared table target. This is deliberately limited
 * to structural write/DDL clauses; ordinary table mentions and task names do
 * not create evidence by themselves.
 */
export function findSqlTargetEvidence(
  sql: Readonly<Partial<Record<SqlTargetSlot, string>>>,
  taskName?: string,
  options: Readonly<{ allowSchemaOnlyQualification?: boolean }> = {},
): SqlTargetEvidence | undefined {
  const found: SqlTargetEvidence[] = [];
  for (const slot of [
    "create",
    "query",
    "prepare",
    "truncate",
    "finish",
  ] as const) {
    const content = sql[slot];
    if (typeof content !== "string" || content.trim() === "") continue;
    const withoutComments = maskCommentsAndStringLiterals(content);
    for (const { statementKind, pattern } of TARGET_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of withoutComments.matchAll(pattern)) {
        const parsed = normalizeQualifiedName(match[1]!);
        if (parsed === undefined) continue;
        const qualifiedName = qualifyUnqualifiedTarget(
          parsed,
          taskName,
          options.allowSchemaOnlyQualification === true,
        );
        if (qualifiedName === undefined) continue;
        found.push({ qualifiedName, slot, statementKind });
      }
    }
  }
  const unique = new Map<string, SqlTargetEvidence>();
  for (const evidence of found) {
    const key = evidence.qualifiedName.toLowerCase();
    const existing = unique.get(key);
    if (existing === undefined) unique.set(key, evidence);
    else if (existing.qualifiedName !== evidence.qualifiedName)
      return undefined;
  }
  return unique.size === 1 ? [...unique.values()][0] : undefined;
}

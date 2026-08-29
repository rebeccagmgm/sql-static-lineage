import { canonicalJson, sha256 } from "../machine-facts/machine-facts-contract.ts";

export interface DialectTransform {
  readonly transformId: string;
  readonly transformKind: "QUOTE_RESERVED_IDENTIFIER";
  readonly identifier: string;
  readonly beforeSpan: { readonly start: number; readonly end: number };
  readonly afterSpan: { readonly start: number; readonly end: number };
  readonly reason: string;
}
export interface DialectTransformResult {
  readonly status: "UNCHANGED" | "TRANSFORMED";
  readonly sql: string;
  readonly manifestVersion: "0.1.0-poc";
  readonly sourceSha256: string;
  readonly transformedSha256: string;
  readonly transforms: readonly DialectTransform[];
}

const QUOTABLE = new Set(["CONDITION", "OPERATOR"]);

export function adaptHiveCompatSql(sql: string): DialectTransformResult {
  const tokens = lexicalTokens(sql);
  const replacements: { start: number; end: number; text: string; identifier: string }[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.kind !== "WORD" || !QUOTABLE.has(token.text.toUpperCase())) continue;
    const previous = tokens[index - 1];
    const quote = previous?.text === "." || previous?.text.toUpperCase() === "AS";
    if (quote) replacements.push({ start: token.start, end: token.end, text: `\`${token.text}\``, identifier: token.text });
  }
  let transformed = sql;
  for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
    transformed = `${transformed.slice(0, replacement.start)}${replacement.text}${transformed.slice(replacement.end)}`;
  }
  let offset = 0;
  const transforms = replacements.sort((left, right) => left.start - right.start).map((replacement) => {
    const afterStart = replacement.start + offset;
    offset += replacement.text.length - (replacement.end - replacement.start);
    const basis = { kind: "QUOTE_RESERVED_IDENTIFIER", identifier: replacement.identifier, start: replacement.start, end: replacement.end };
    return {
      transformId: `dialect-transform:${sha256(canonicalJson(basis))}`,
      transformKind: "QUOTE_RESERVED_IDENTIFIER" as const,
      identifier: replacement.identifier,
      beforeSpan: { start: replacement.start, end: replacement.end },
      afterSpan: { start: afterStart, end: afterStart + replacement.text.length },
      reason: "Calcite Lex.JAVA reserves this identifier; backtick quoting preserves identifier identity and relation semantics.",
    };
  });
  return {
    status: transforms.length === 0 ? "UNCHANGED" : "TRANSFORMED",
    sql: transformed,
    manifestVersion: "0.1.0-poc",
    sourceSha256: sha256(sql),
    transformedSha256: sha256(transformed),
    transforms,
  };
}

type Token = { readonly kind: "WORD" | "PUNCT"; readonly text: string; readonly start: number; readonly end: number };
function lexicalTokens(sql: string): Token[] {
  const output: Token[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index]!;
    if (/\s/.test(char)) { index++; continue; }
    if (char === "'" || char === '"' || char === "`") {
      const quote = char; index++;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) { index += 2; continue; }
          index++; break;
        }
        index++;
      }
      continue;
    }
    if (char === "-" && sql[index + 1] === "-") { index += 2; while (index < sql.length && sql[index] !== "\n") index++; continue; }
    if (char === "/" && sql[index + 1] === "*") { index += 2; while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) index++; index = Math.min(sql.length, index + 2); continue; }
    if (/[A-Za-z_]/.test(char)) {
      const start = index++; while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index]!)) index++;
      output.push({ kind: "WORD", text: sql.slice(start, index), start, end: index }); continue;
    }
    output.push({ kind: "PUNCT", text: char, start: index, end: ++index });
  }
  return output;
}

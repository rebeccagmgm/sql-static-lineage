/**
 * Canonical partition values for cross-task continuation matching.
 * Aligns Input Pack temporal templates with read predicates and write partitions.
 */

export function isTemporalPartitionColumn(column: string): boolean {
  const normalized = column.trim().toLowerCase();
  return (
    normalized === "busi_date" ||
    normalized === "data_date" ||
    normalized === "busi_mon" ||
    normalized === "busi_year" ||
    normalized.endsWith("_date") ||
    normalized.endsWith("_mon") ||
    normalized.endsWith("_month") ||
    normalized.endsWith("_year")
  );
}

export function isRuntimeTemplateExpression(value: string): boolean {
  return /\$\{|\{\{|\{%|<%/u.test(value);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeTemplateInner(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function temporalTemplateFromInner(inner: string): string | undefined {
  const normalized = normalizeTemplateInner(inner);
  if (normalized === "datadaystr" || normalized === "yyyymmdd" || normalized === "yyyy-mm-dd" || (normalized.startsWith("yyyy") && normalized.includes("mm") && normalized.includes("dd"))) return "${YYYY-MM-DD}";
  const monthMatch = inner.match(/^(yyyy(?:-MM)?|YYYY(?:-MM)?)(,[-+]?\d+[mMdDyY])?$/u);
  if (monthMatch?.[1] !== undefined) {
    const format = monthMatch[1].toLowerCase() === "yyyy-mm" ? "YYYY-MM" : "YYYYMM";
    return `\${${format}${monthMatch[2] ?? ""}}`;
  }
  if (normalized === "yyyymm" || normalized === "yyyyMM".toLowerCase()) return "${YYYYMM}";
  if (normalized === "yyyy") return "${YYYY}";
  return undefined;
}

/** Canonicalize one partition value for equality checks. */
export function canonicalPartitionValue(
  column: string,
  raw: string,
): string {
  const value = stripQuotes(raw);
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value) && isTemporalPartitionColumn(column)) return "${YYYY-MM-DD}";
  const template = value.match(/^\$\{([^}]+)\}$/u);
  if (template) {
    if (isTemporalPartitionColumn(column)) {
      const temporal = temporalTemplateFromInner(template[1]!);
      if (temporal) return temporal;
    }
    return `\${${template[1]!.trim()}}`;
  }
  if (/\$\{[^}]+\}/u.test(value) && isTemporalPartitionColumn(column)) {
    const token = value.match(/\$\{([^}]+)\}/u);
    if (token) {
      const temporal = temporalTemplateFromInner(token[1]!);
      if (temporal) return temporal;
    }
  }
  return value;
}

export function canonicalPartitionValues(
  column: string,
  values: readonly string[],
): readonly string[] {
  return [...new Set(values.map((value) => canonicalPartitionValue(column, value)))];
}

export function partitionCanonicalValuesOverlap(
  column: string,
  leftValues: readonly string[],
  rightValues: readonly string[],
): boolean {
  const left = new Set(
    canonicalPartitionValues(column, leftValues).map((value) => value.toLowerCase()),
  );
  return canonicalPartitionValues(column, rightValues).some((value) =>
    left.has(value.toLowerCase()),
  );
}

export function writePartitionRawValues(part: {
  readonly values: readonly string[];
  readonly expression?: string;
  readonly observedValue?: string | null;
}): readonly string[] {
  const raw = [
    ...part.values,
    ...(part.expression ? [part.expression] : []),
    ...(part.observedValue ? [part.observedValue] : []),
  ].filter((value) => value.trim().length > 0);
  return raw.length > 0 ? raw : part.values;
}

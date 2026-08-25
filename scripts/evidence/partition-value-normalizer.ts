export function normalizePartitionToken(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/gu, "")
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

export function isDatePartitionField(field: string): boolean {
  return /^(busi_date|business_date|biz_date|trade_date|data_date|month_date|monthdate|dt)$/iu.test(
    normalizePartitionToken(field),
  );
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value.trim());
}

export function isDateRuntimeTemplate(value: string): boolean {
  return normalizePartitionToken(value) === "${yyyy-mm-dd}";
}

export function datePartitionValuesCompatible(
  left: string,
  right: string,
): boolean {
  const normalizedLeft = normalizePartitionToken(left);
  const normalizedRight = normalizePartitionToken(right);
  if (normalizedLeft === normalizedRight) return true;
  return (
    (isDateRuntimeTemplate(normalizedLeft) && isIsoDate(normalizedRight)) ||
    (isDateRuntimeTemplate(normalizedRight) && isIsoDate(normalizedLeft))
  );
}

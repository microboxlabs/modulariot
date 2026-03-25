export function parseIntOrThrow(value: string, fieldName: string): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for ${fieldName}: "${value}"`);
  }
  return parsed;
}

export function parseOptionalInt(
  value: string | undefined,
  fieldName: string,
): number | undefined {
  if (value === undefined) return undefined;
  return parseIntOrThrow(value, fieldName);
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function getNestedValue(obj: object, dotPath: string): unknown {
  let current: unknown = obj;
  for (const key of dotPath.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export interface Column {
  header: string;
  key: string;
}

export function printTable(rows: object[], columns: Column[]): void {
  if (rows.length === 0) {
    console.log("No results found.");
    return;
  }

  const widths = columns.map((col) => {
    const values = rows.map((row) =>
      String(getNestedValue(row, col.key) ?? ""),
    );
    return Math.max(col.header.length, ...values.map((v) => v.length));
  });

  const header = columns
    .map((col, i) => col.header.padEnd(widths[i]!))
    .join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const line = columns
      .map((col, i) =>
        String(getNestedValue(row, col.key) ?? "").padEnd(widths[i]!),
      )
      .join("  ");
    console.log(line);
  }
}

export function printDetail(obj: object): void {
  const entries = Object.entries(obj);
  if (entries.length === 0) return;

  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));

  for (const [key, value] of entries) {
    let displayValue: string;
    if (typeof value === "object" && value !== null) {
      try {
        displayValue = JSON.stringify(value);
      } catch {
        displayValue = "[Circular]";
      }
    } else {
      displayValue = String(value ?? "");
    }
    console.log(`${key.padEnd(maxKeyLen)}  ${displayValue}`);
  }
}

export function printSuccess(message: string): void {
  console.log(message);
}

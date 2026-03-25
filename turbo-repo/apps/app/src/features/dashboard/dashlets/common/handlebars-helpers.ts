import Handlebars from "handlebars";

// ============================================================================
// Handlebars validation helpers
// ============================================================================

export type HandlebarsStatus = "valid" | "invalid" | "none";

/** Allowed characters inside a Handlebars expression. */
const ALLOWED_INNER_CHARS = new Set(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_ \t.#/^>@!-"
);

/** Extract `{{…}}` expressions from text without regex. */
export function findHandlebarsExpressions(text: string): string[] {
  const results: string[] = [];
  let start = text.indexOf("{{");
  while (start !== -1) {
    const end = text.indexOf("}}", start + 2);
    if (end === -1) break;
    results.push(text.substring(start, end + 2));
    start = text.indexOf("{{", end + 2);
  }
  return results;
}

function isValidInner(inner: string): boolean {
  for (const ch of inner) {
    if (!ALLOWED_INNER_CHARS.has(ch)) return false;
  }
  return true;
}

export function getHandlebarsStatus(text: string): HandlebarsStatus {
  const matches = findHandlebarsExpressions(text);
  if (matches.length === 0) return "none";

  for (const match of matches) {
    const inner = match.slice(2, -2).trim();
    if (
      !inner ||
      inner.endsWith(".") ||
      inner.startsWith(".") ||
      inner.includes("..") ||
      !isValidInner(inner)
    ) {
      return "invalid";
    }
  }

  try {
    Handlebars.compile(text);
    return "valid";
  } catch {
    return "invalid";
  }
}

export function getFlowbiteColor(
  status: HandlebarsStatus
): "gray" | "success" | "failure" {
  switch (status) {
    case "valid":
      return "success";
    case "invalid":
      return "failure";
    default:
      return "gray";
  }
}

/**
 * Extract the data property name from a column key.
 * - `{{row.origin}}`  → `"origin"`
 * - `{{origin}}`      → `"origin"`
 * - `{{ origin }}`    → `"origin"`
 * - `origin`          → `"origin"` (plain text — used for sort/filter lookup)
 * Returns `null` for complex templates like `{{a}} - {{b}}`.
 */
export function resolveDataProperty(key: string): string | null {
  if (!key.includes("{{")) return key;
  const match = /^\{\{\s*(?:row\.)?(\w+)\s*\}\}$/.exec(key);
  return match ? match[1] : null;
}

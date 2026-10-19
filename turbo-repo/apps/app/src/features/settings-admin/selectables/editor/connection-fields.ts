import { schemaLeafPaths } from "@/features/integration-config/integration-config.types";
import {
  checkTemplate,
  type TemplateStatus,
} from "@/features/shipping/components/lane/review-template-validation";

/** The roots a connection list's templates read, mirroring `ConnectionOptionSource`. */
export const RESPONSE_ROOTS: readonly string[] = ["response"];
export const ITEM_ROOTS: readonly string[] = ["item"];

/** Where the API looks for the items when none is given. */
const USUAL_ITEMS = ["data", "items", "results"];

/**
 * Every array a response schema declares, by dot path ("" when the answer is
 * itself an array), with the leaf fields of its items.
 */
export function responseLists(
  schema: Record<string, unknown> | null | undefined
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  walk(schema, "", out);
  return out;
}

function walk(node: unknown, prefix: string, out: Map<string, string[]>) {
  if (typeof node !== "object" || node === null) return;
  const schema = node as Record<string, unknown>;
  if (schema.type === "array" && isRecord(schema.items)) {
    out.set(prefix, schemaLeafPaths(schema.items));
    return;
  }
  if (schema.type === "object" && isRecord(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      walk(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

/**
 * The fields of the items an `items` template points at; blank picks the list
 * the API would, and anything unknown offers every list's fields.
 */
export function itemFields(
  lists: Map<string, string[]>,
  itemsTemplate: string
): string[] {
  const trimmed = itemsTemplate.trim();
  const named = /^\{\{\s*response\.([\w.]+)\s*\}\}$/.exec(trimmed)?.[1];
  const chosen =
    named ??
    (trimmed ? undefined : ["", ...USUAL_ITEMS].find((p) => lists.has(p)));
  if (chosen !== undefined && lists.has(chosen)) {
    return lists.get(chosen) ?? [];
  }
  return [...new Set([...lists.values()].flat())];
}

/**
 * `checkTemplate` for `items`, which must also be one variable and nothing
 * else, as `ConnectionOptionSource` requires.
 */
export function checkItems(template: string): {
  status: TemplateStatus;
  problem?: { code: string };
} {
  const check = checkTemplate(template, RESPONSE_ROOTS);
  if (check.status !== "valid") return check;
  return /^\{\{[^{}]*\}\}$/.test(template.trim())
    ? check
    : { status: "invalid", problem: { code: "notSingle" } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { ActionItem, ActionsConfig, RowAction } from "./action-types";
import { ACTION_TARGETS, ROW_ACTION_METHODS } from "./action-types";

export interface ActionItemWithId extends ActionItem {
  _id: string;
}

export function toActionItems(items: ActionItem[]): ActionItemWithId[] {
  return items.map((item, i) => ({ ...item, _id: `act-${i}-${item.name}` }));
}

export function fromActionItems(items: ActionItemWithId[]): ActionItem[] {
  return items.map(({ name, link, target }) => ({ name, link, target }));
}

/** Check the navigation scheme, including browser-stripped ASCII whitespace.
 * This does not validate hostname syntax or grant permission to a destination.
 * Check resolved template output again immediately before navigation.
 */
export function isSafeActionUrl(url: string): boolean {
  let start = 0;
  let end = url.length;
  while (start < end && url.charCodeAt(start) <= 32) start++;
  while (end > start && url.charCodeAt(end - 1) <= 32) end--;
  if (start === end) return false;
  let scheme = "";
  for (let index = start; index < end; index++) {
    const char = url.charAt(index);
    if (char === "\t" || char === "\r" || char === "\n") continue;
    if (char === ":")
      return ["https", "http", "mailto", "tel"].includes(scheme.toLowerCase());
    if (char === "/" || char === "\\" || char === "?" || char === "#")
      return true;
    scheme += char;
  }
  return true;
}

function isValidActionItem(item: unknown): item is ActionItem {
  if (item == null || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (!["name", "link", "target"].every((key) => Object.hasOwn(obj, key)))
    return false;
  return (
    typeof obj.name === "string" &&
    typeof obj.link === "string" &&
    isSafeActionUrl(obj.link) &&
    typeof obj.target === "string" &&
    (ACTION_TARGETS as string[]).includes(obj.target)
  );
}

export function normalizeActionsConfig(
  raw: unknown,
  fallback: ActionsConfig,
): ActionsConfig {
  if (raw == null || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.enabled !== "boolean") return fallback;
  if (!Array.isArray(obj.items)) return fallback;
  if (!obj.items.every(isValidActionItem)) return fallback;
  return { enabled: obj.enabled, items: obj.items };
}

// ── Row actions ──────────────────────────────────────────────────────────────

export interface RowActionItemWithId extends RowAction {
  _id: string;
}

export function toRowActionItems(items: RowAction[]): RowActionItemWithId[] {
  return items.map((item, i) => ({ ...item, _id: `ra-${i}-${item.name}` }));
}

export function fromRowActionItems(items: RowActionItemWithId[]): RowAction[] {
  return items.map(({ method, name, link, target }) => ({
    method,
    name,
    link,
    target,
  }));
}

function isValidRowAction(item: unknown): item is RowAction {
  if (item == null || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (!["name", "link", "target"].every((key) => Object.hasOwn(obj, key)))
    return false;
  return (
    typeof obj.name === "string" &&
    typeof obj.link === "string" &&
    isSafeActionUrl(obj.link) &&
    Object.hasOwn(obj, "method") &&
    typeof obj.method === "string" &&
    (ROW_ACTION_METHODS as string[]).includes(obj.method) &&
    typeof obj.target === "string" &&
    (ACTION_TARGETS as string[]).includes(obj.target)
  );
}

export function normalizeRowActions(raw: unknown): RowAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidRowAction);
}

import type { ActionItem, ActionsConfig } from "./action-types";
import { ACTION_TARGETS } from "./action-types";

export interface ActionItemWithId extends ActionItem {
  _id: string;
}

export function toActionItems(items: ActionItem[]): ActionItemWithId[] {
  return items.map((item, i) => ({ ...item, _id: `act-${i}-${item.name}` }));
}

export function fromActionItems(items: ActionItemWithId[]): ActionItem[] {
  return items.map(({ name, link, target }) => ({ name, link, target }));
}

function isValidActionItem(item: unknown): item is ActionItem {
  if (item == null || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.link === "string" &&
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

export type ActionTarget = "_self" | "_blank";

export const ACTION_TARGETS: ActionTarget[] = ["_self", "_blank"];

export interface ActionItem {
  name: string;
  link: string;
  target: ActionTarget;
}

export interface ActionsConfig {
  enabled: boolean;
  items: ActionItem[];
}

// ── Row actions (unified click + right-click list) ──────────────────────────

export type RowActionMethod = "goto";

export const ROW_ACTION_METHODS: RowActionMethod[] = ["goto"];

export interface RowAction {
  method: RowActionMethod;
  name: string;
  link: string;
  target: ActionTarget;
}

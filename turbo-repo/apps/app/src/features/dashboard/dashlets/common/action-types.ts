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

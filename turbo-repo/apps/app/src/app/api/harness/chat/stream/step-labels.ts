/**
 * Human labels for the harness tools a run uses, shown in the chat's live
 * progress. Connection tools are named `<connection>_<primitive>`, so a tool
 * is matched on its primitive suffix; anything unknown keeps its raw name.
 */

export const STEP_KEYS = [
  "list_tables",
  "describe",
  "profile",
  "select",
  "query",
  "grep",
  "explain",
  "functions",
  "definition",
  "call",
  "knowledge",
  "show",
  "memory",
  "analysis",
  "web_search",
  "web_fetch",
  "load_skill",
  "write_todos",
  "delegate",
  "ask_advisor",
  "fs_write",
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

/** The step a tool name stands for, or null when it has no label. */
export function stepKeyOf(tool: string): StepKey | null {
  const exact = STEP_KEYS.find((key) => tool === key);
  if (exact) return exact;
  return STEP_KEYS.find((key) => tool.endsWith(`_${key}`)) ?? null;
}

export function stepLabel(tool: string, tr: (key: string) => string): string {
  const key = stepKeyOf(tool);
  return key ? tr(`harnessChat.stream.steps.${key}`) : tool;
}

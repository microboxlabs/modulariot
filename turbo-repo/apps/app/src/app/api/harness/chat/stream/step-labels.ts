/**
 * Human labels for the harness tools a run uses, shown in the chat's live
 * progress. Connection tools are named `<connection>_<primitive>`, so a tool
 * is matched on its primitive suffix; anything unknown keeps its raw name.
 */

import type { TrFn } from "@/features/i18n/i18n.service.types";

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
  "artifact",
  "workflow",
  "source_search",
  "source_read",
  "source_list",
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

/** The step a tool name stands for, or null when it has no label. */
export function stepKeyOf(tool: string): StepKey | null {
  const exact = STEP_KEYS.find((key) => tool === key);
  if (exact) return exact;
  return STEP_KEYS.find((key) => tool.endsWith(`_${key}`)) ?? null;
}

export const MCP_STEP_KEYS = [
  "stories_list",
  "stories_get",
  "stories_create",
  "stories_add_version",
  "stories_link",
  "connections_create",
  "connections_test",
  "connections",
  "selectables",
] as const;

export type McpStepKey = (typeof MCP_STEP_KEYS)[number];

/** The step an MCP tool stands for: its own name, else its family prefix. */
export function mcpStepKeyOf(tool: string): McpStepKey | null {
  const exact = MCP_STEP_KEYS.find((key) => key === tool);
  if (exact) return exact;
  return MCP_STEP_KEYS.find((key) => tool.startsWith(`${key}_`)) ?? null;
}

function mcpToolOf(args: unknown): string | null {
  if (typeof args !== "object" || args === null) return null;
  const tool = (args as Record<string, unknown>).tool;
  return typeof tool === "string" && tool ? tool : null;
}

/** `args` is the tool's arguments as its `tool.started` event carries them:
 * an `mcp_call` is labelled by the MCP tool it calls. */
export function stepLabel(tool: string, tr: TrFn, args?: unknown): string {
  const inner = tool === "mcp_call" ? mcpToolOf(args) : null;
  if (inner) {
    const key = mcpStepKeyOf(inner);
    return key
      ? tr(`harnessChat.stream.mcpSteps.${key}`)
      : tr("harnessChat.stream.mcpSteps.other", { tool: inner });
  }
  const key = stepKeyOf(tool);
  return key ? tr(`harnessChat.stream.steps.${key}`) : tool;
}

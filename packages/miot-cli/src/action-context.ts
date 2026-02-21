import type { Command } from "commander";
import { resolveConfig, resolveOutputMode, type OutputMode } from "./config.js";
import { createClient, type MiotClient } from "./client-factory.js";

export interface ActionContext {
  client: MiotClient;
  outputMode: OutputMode;
}

function collectGlobalOpts(cmd: Command): Record<string, unknown> {
  let current: Command | null = cmd;
  const merged: Record<string, unknown> = {};
  while (current) {
    const localOpts = current.opts();
    for (const [key, value] of Object.entries(localOpts)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
    current = current.parent;
  }
  return merged;
}

export function getActionContext(cmd: Command): ActionContext {
  const globals = collectGlobalOpts(cmd) as {
    baseUrl?: string;
    token?: string;
    profile?: string;
    output?: string;
  };

  const config = resolveConfig(globals);
  const client = createClient(config);
  const outputMode = resolveOutputMode(globals);

  return { client, outputMode };
}

import type { Command } from "commander";
import { resolveConfig, resolveOutputMode, type OutputMode } from "./config.js";
import { createClient, type MiotClient } from "./client-factory.js";

export interface ActionContext {
  client: MiotClient;
  outputMode: OutputMode;
}

export function getActionContext(cmd: Command): ActionContext {
  const globals = cmd.optsWithGlobals<{
    baseUrl?: string;
    token?: string;
    profile?: string;
    output?: string;
  }>();

  const config = resolveConfig(globals);
  const client = createClient(config);
  const outputMode = resolveOutputMode(globals);

  return { client, outputMode };
}

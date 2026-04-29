import type { Command } from "commander";
import { resolveConfig, resolveOutputMode, type OutputMode } from "./config.js";
import { createClient, type MiotClient } from "./client-factory.js";

export interface ActionContext {
  client: MiotClient;
  outputMode: OutputMode;
}

function isConnectionsCommand(cmd: Command): boolean {
  let current: Command | null = cmd;
  while (current) {
    if (current.name() === "connections") {
      return true;
    }
    current = current.parent ?? null;
  }
  return false;
}

export function getActionContext(cmd: Command): ActionContext {
  const globals = cmd.optsWithGlobals<{
    baseUrl?: string;
    token?: string;
    organization?: string;
    profile?: string;
    output?: string;
  }>();

  const config = resolveConfig(globals);
  if (isConnectionsCommand(cmd) && !config.organizationId) {
    console.error(
      "Error: missing organization ID. Use --organization, MIOT_ORGANIZATION_ID env, or ~/.miotrc.json",
    );
    process.exit(3);
  }

  const client = createClient(config);
  const outputMode = resolveOutputMode(globals);

  return { client, outputMode };
}

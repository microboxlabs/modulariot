import type { Command } from "commander";
import {
  createMiotHarnessClient,
  type MiotHarnessClient,
} from "@microboxlabs/miot-harness-client";
import { resolveOutputMode, type OutputMode } from "./config.js";

export interface HarnessActionContext {
  client: MiotHarnessClient;
  outputMode: OutputMode;
}

export function getHarnessActionContext(cmd: Command): HarnessActionContext {
  const globals = cmd.optsWithGlobals<{
    harnessBaseUrl?: string;
    harnessToken?: string;
    output?: string;
  }>();

  const baseUrl =
    globals.harnessBaseUrl ??
    process.env.MIOT_HARNESS_BASE_URL ??
    "http://localhost:8000";
  const token = globals.harnessToken ?? process.env.MIOT_HARNESS_TOKEN ?? null;

  const client = createMiotHarnessClient({ baseUrl, token });
  const outputMode = resolveOutputMode(globals);
  return { client, outputMode };
}

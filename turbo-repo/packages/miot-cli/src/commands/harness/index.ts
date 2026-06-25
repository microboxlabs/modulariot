import type { Command } from "commander";
import { registerHarnessCreateCommand } from "./create.js";
import { registerHarnessRunsCommand } from "./runs.js";
import { registerHarnessSkillsCommand } from "./skills.js";

export function registerHarnessCommand(program: Command): void {
  const harness = program
    .command("harness")
    .description(
      "Drive miot-harness runs (POST /runs:start, GET /runs/{id}). Live SSE streaming lives in miot-chat.",
    )
    .option(
      "--harness-base-url <url>",
      "Harness base URL (or MIOT_HARNESS_BASE_URL env, default http://localhost:8000)",
    )
    .option(
      "--harness-token <token>",
      "Harness auth bearer token (or MIOT_HARNESS_TOKEN env)",
    );

  registerHarnessCreateCommand(harness);
  registerHarnessRunsCommand(harness);
  registerHarnessSkillsCommand(harness);
}

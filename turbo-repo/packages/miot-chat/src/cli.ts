import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAskCommand } from "./commands/ask.js";
import { registerResumeCommand } from "./commands/resume.js";
import { registerRunsCommand } from "./commands/runs.js";
import { resolveConfig, type CliFlags } from "./config.js";
import { createHarnessClient } from "./harness/client.js";
import { runRepl } from "./repl/loop.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("miot-chat")
  .description(
    "Copilot-style agentic chat CLI for miot-harness (SSE streaming).",
  )
  .version(version)
  .option("--base-url <url>", "Harness base URL (or MIOT_CHAT_BASE_URL env)")
  .option("--token <token>", "Auth bearer token (or MIOT_CHAT_TOKEN env)")
  .option("--tenant <id>", "Tenant ID (or MIOT_CHAT_TENANT_ID env)")
  .option("--user <id>", "User ID (or MIOT_CHAT_USER_ID env)")
  .option(
    "--mode <mode>",
    "Dispatch mode: auto | canned | meta | agentic (or MIOT_CHAT_MODE env)",
  )
  .option(
    "--profile <name>",
    "Named profile from ~/.miot-chat/config.json (or MIOT_CHAT_PROFILE env)",
  )
  .action(async () => {
    const flags = program.opts<CliFlags>();
    const config = resolveConfig({ flags });
    const client = createHarnessClient({
      baseUrl: config.baseUrl,
      token: config.token,
    });
    const code = await runRepl({ config, client });
    process.exit(code);
  });

registerAskCommand(program);
registerResumeCommand(program);
registerRunsCommand(program);

program.parseAsync().catch((err: unknown) => {
  process.stderr.write(
    `${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});

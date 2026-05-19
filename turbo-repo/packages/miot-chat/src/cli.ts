import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAskCommand } from "./commands/ask.js";
import { registerResumeCommand } from "./commands/resume.js";
import { registerRunsCommand } from "./commands/runs.js";
import { resolveConfig, type CliFlags } from "./config.js";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { runRepl } from "./repl/loop.js";
import { runTui } from "./tui/runTui.js";

/**
 * Decide whether to mount the Ink TUI or fall back to the line-based
 * REPL. Exported so tests can exercise the boundary without spawning a
 * subprocess.
 *
 * The TUI requires BOTH stdin and stdout to be TTYs; piping either way
 * (`echo ... | miot-chat`, `miot-chat > out.txt`) drops to headless.
 * MIOT_CHAT_NO_TUI=1 is the explicit override for CI / scripts that
 * happen to run inside a pty.
 */
export function shouldUseTui(
  env: NodeJS.ProcessEnv,
  stdin: { isTTY?: boolean },
  stdout: { isTTY?: boolean },
): boolean {
  if (env.MIOT_CHAT_NO_TUI === "1") return false;
  return Boolean(stdin.isTTY && stdout.isTTY);
}

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
    const client = createMiotHarnessClient({
      baseUrl: config.baseUrl,
      token: config.token,
    });
    if (shouldUseTui(process.env, process.stdin, process.stdout)) {
      const handle = runTui({ config, client });
      await handle.waitUntilExit();
      process.exit(0);
    }
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

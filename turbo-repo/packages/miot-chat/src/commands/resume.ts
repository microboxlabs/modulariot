import type { Command } from "commander";
import { resolveConfig, type CliFlags } from "../config.js";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { dim, red, type ColorOptions } from "../output.js";
import { readLastConversation } from "../repl/conversation.js";
import { runRepl } from "../repl/loop.js";
import { shouldUseTui } from "../cli.js";
import { runTui } from "../tui/runTui.js";

export function registerResumeCommand(program: Command): void {
  program
    .command("resume")
    .description(
      "Resume the most recent session. In a TTY launches the TUI (use /resume inside to pick); piped stdin reuses the last conversation_id with the headless REPL.",
    )
    .action(async () => {
      const flags = program.opts<CliFlags>();
      const config = resolveConfig({ flags });
      const client = createMiotHarnessClient({
        baseUrl: config.baseUrl,
        token: config.token,
      });

      if (shouldUseTui(process.env, process.stdin, process.stdout)) {
        // The new TUI's persistence model is per-session-file
        // (~/.miot-chat/sessions/), which doesn't map cleanly onto the
        // legacy single-id last-conversation file. We launch the TUI and
        // let the user pick from the saved sessions via /resume.
        const handle = runTui({ config, client });
        await handle.waitUntilExit();
        process.exit(0);
      }

      const color: ColorOptions = {
        noColor: Boolean(process.env.NO_COLOR),
        isTTY: process.stdout.isTTY,
      };
      const conversationId = readLastConversation();
      if (conversationId === null) {
        process.stderr.write(
          `${red("no saved conversation found at ~/.miot-chat/last-conversation", color)}\n`,
        );
        process.exit(1);
      }
      process.stdout.write(
        `${dim(`resuming conversation: ${conversationId}`, color)}\n`,
      );
      const code = await runRepl({ config, client, conversationId });
      process.exit(code);
    });
}

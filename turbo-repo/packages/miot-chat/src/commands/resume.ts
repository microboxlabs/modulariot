import type { Command } from "commander";
import { resolveConfig, type CliFlags } from "../config.js";
import { createHarnessClient } from "../harness/client.js";
import { dim, red, type ColorOptions } from "../output.js";
import { readLastConversation } from "../repl/conversation.js";
import { runRepl } from "../repl/loop.js";

export function registerResumeCommand(program: Command): void {
  program
    .command("resume")
    .description(
      "Resume the most recent REPL session using ~/.miot-chat/last-conversation.",
    )
    .action(async () => {
      const flags = program.opts<CliFlags>();
      const config = resolveConfig({ flags });
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

      const client = createHarnessClient({
        baseUrl: config.baseUrl,
        token: config.token,
      });
      const code = await runRepl({ config, client, conversationId });
      process.exit(code);
    });
}

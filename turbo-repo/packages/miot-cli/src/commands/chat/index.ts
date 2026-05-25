import type { Command } from "commander";
import {
  resolveConfig,
  runMiotChat,
  type CliFlags as MiotChatFlags,
} from "@microboxlabs/miot-chat";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";

/**
 * `miot chat` — open the miot-chat TUI against a harness. Mirrors the
 * standalone `miot-chat` binary's default action; uses the same
 * ~/.miot-chat/config.json + MIOT_CHAT_* env vars + flag precedence.
 *
 * In a TTY this mounts the Ink TUI. On piped stdin (or with
 * MIOT_CHAT_NO_TUI=1) it falls back to the headless line REPL.
 *
 * The chat-local flag names match the standalone binary so muscle
 * memory transfers (--tenant, --user, --mode, --profile). For the
 * harness URL/token we prefix with --harness- to match the
 * convention used by `miot harness`.
 */
export function registerChatCommand(program: Command): void {
  program
    .command("chat")
    .description(
      "Open the interactive miot-chat TUI (or headless REPL on piped stdin)",
    )
    .option(
      "--harness-base-url <url>",
      "Harness base URL (or MIOT_CHAT_BASE_URL env, default http://localhost:8000)",
    )
    .option(
      "--harness-token <token>",
      "Harness auth bearer token (or MIOT_CHAT_TOKEN env)",
    )
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
    .action(
      async (opts: {
        harnessBaseUrl?: string;
        harnessToken?: string;
        tenant?: string;
        user?: string;
        mode?: string;
        profile?: string;
      }) => {
        const flags: MiotChatFlags = {
          baseUrl: opts.harnessBaseUrl,
          token: opts.harnessToken,
          tenant: opts.tenant,
          user: opts.user,
          mode: opts.mode,
          profile: opts.profile,
        };
        const config = resolveConfig({ flags });
        const client = createMiotHarnessClient({
          baseUrl: config.baseUrl,
          token: config.token,
        });
        const code = await runMiotChat({ config, client });
        process.exit(code);
      },
    );
}

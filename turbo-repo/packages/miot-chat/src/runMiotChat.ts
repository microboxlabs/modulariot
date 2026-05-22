// Programmatic entry point for embedding miot-chat in another CLI
// (notably @microboxlabs/miot-cli's `miot chat` subcommand). This is
// the same fork that src/cli.ts performs at the binary level:
//
//   - If both stdin and stdout are TTYs and MIOT_CHAT_NO_TUI is not
//     "1", launch the Ink TUI via runTui().
//   - Otherwise, fall back to the legacy line-based REPL via runRepl().
//
// Returns the exit code the caller should propagate (0 on success).
//
// shouldUseTui is exported here (instead of from cli.ts) so consumers
// don't have to import a bin module — importing src/cli.ts would
// execute its top-level Commander setup as a side effect.

import type { MiotHarnessClient } from "@microboxlabs/miot-harness-client";
import type { ResolvedConfig } from "./config.js";
import { runRepl } from "./repl/loop.js";
import { runTui } from "./tui/runTui.js";

export interface RunMiotChatOptions {
  config: ResolvedConfig;
  client: MiotHarnessClient;
  env?: NodeJS.ProcessEnv;
  stdin?: { isTTY?: boolean };
  stdout?: { isTTY?: boolean };
  /**
   * Optional conversation id to forward to the headless REPL. Ignored
   * in TUI mode (the user picks via /resume). Mirrors the legacy
   * `miot-chat resume` flow.
   */
  conversationId?: string;
}

export function shouldUseTui(
  env: NodeJS.ProcessEnv,
  stdin: { isTTY?: boolean },
  stdout: { isTTY?: boolean },
): boolean {
  if (env.MIOT_CHAT_NO_TUI === "1") return false;
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export async function runMiotChat(opts: RunMiotChatOptions): Promise<number> {
  const env = opts.env ?? process.env;
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;
  if (shouldUseTui(env, stdin, stdout)) {
    const handle = runTui({ config: opts.config, client: opts.client });
    await handle.waitUntilExit();
    return 0;
  }
  return runRepl({
    config: opts.config,
    client: opts.client,
    conversationId: opts.conversationId,
  });
}

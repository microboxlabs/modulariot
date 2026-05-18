import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import type { ResolvedConfig, CliFlags } from "../config.js";
import { resolveConfig } from "../config.js";
import { createHarnessClient } from "../harness/client.js";
import {
  HarnessRunError,
  type HarnessEvent,
  type UserRequest,
} from "../harness/types.js";
import { dim, red, type ColorOptions } from "../output.js";
import {
  initialState,
  renderAuthoritativeAnswer,
  renderEvent,
  renderRunFailure,
  type RenderState,
} from "../repl/renderer.js";

export interface AskOptions {
  message: string;
  config: ResolvedConfig;
  conversationId?: string;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  noColor?: boolean;
}

export async function runAsk(opts: AskOptions): Promise<number> {
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const color: ColorOptions = {
    noColor: opts.noColor ?? Boolean(process.env.NO_COLOR),
    isTTY: "isTTY" in stdout ? (stdout as { isTTY?: boolean }).isTTY : false,
  };

  const client = createHarnessClient({
    baseUrl: opts.config.baseUrl,
    token: opts.config.token,
  });

  const req: UserRequest = {
    message: opts.message,
    tenant_id: opts.config.tenantId,
    user_id: opts.config.userId,
    mode: opts.config.mode,
    conversation_id: opts.conversationId ?? randomUUID(),
  };

  stdout.write(
    `${dim(`miot-chat → ${opts.config.baseUrl} (${opts.config.mode} / ${opts.config.tenantId})`, color)}\n`,
  );

  let state: RenderState = initialState(color);
  let terminal: "completed" | "failed" | null = null;
  let failureMessage = "";
  let runId = "";
  const events: HarnessEvent[] = [];

  try {
    const { run_id } = await client.createRun(req);
    runId = run_id;
    for await (const event of client.streamRun(run_id)) {
      events.push(event);
      const r = renderEvent(state, event);
      state = r.state;
      if (r.output.length > 0) stdout.write(r.output);
      if (event.type === "run.completed") {
        terminal = "completed";
        break;
      }
      if (event.type === "run.failed") {
        terminal = "failed";
        failureMessage = event.message;
        break;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stderr.write(`${red(`error: ${msg}`, color)}\n`);
    return e instanceof HarnessRunError ? 1 : 2;
  }

  if (terminal === "completed") {
    let answer: string | null = state.pendingAnswer;
    try {
      const record = await client.getRun(runId);
      answer = record.answer;
    } catch {
      // Fall back to whatever we cached from the stream.
    }
    const finalRender = renderAuthoritativeAnswer(state, answer);
    stdout.write(finalRender.output);
    return 0;
  }

  if (terminal === "failed") {
    const failureRender = renderRunFailure(state, failureMessage);
    stdout.write(failureRender.output);
    return 1;
  }

  stderr.write(
    `${red("stream ended without a terminal event", color)}\n`,
  );
  return 2;
}

export function registerAskCommand(program: Command): void {
  program
    .command("ask <message>")
    .description("Send a single message, stream events, print the answer, exit.")
    .option("--conversation <id>", "Override the conversation id for this run")
    .action(async (message: string, cmdOpts: { conversation?: string }) => {
      const flags = program.opts<CliFlags>();
      const config = resolveConfig({ flags });
      const code = await runAsk({
        message,
        config,
        conversationId: cmdOpts.conversation,
      });
      process.exit(code);
    });
}

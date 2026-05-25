// Legacy line-based REPL.
//
// This module survives the D13 cutover because src/cli.ts still routes
// piped-stdin (non-TTY) and MIOT_CHAT_NO_TUI=1 callers here. The new
// Ink TUI in src/tui/ owns the interactive path; this file is the
// minimal renderer-backed fallback for scripts and pipelines.
//
// Planned future work (not gated on D14): re-implement headless mode
// on top of useSession + the projector, then delete this module along
// with src/repl/slash.ts and src/__tests__/slash.test.ts.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import type { ResolvedConfig } from "../config.js";
import {
  MiotHarnessApiError,
  type HarnessEvent,
  type HarnessRunRecord,
  type MiotHarnessClient,
  type RunMode,
  type UserRequest,
} from "@microboxlabs/miot-harness-client";
import {
  CLEAR_LINE,
  bold,
  dim,
  red,
  yellow,
  type ColorOptions,
} from "../output.js";
import {
  initialState,
  renderAuthoritativeAnswer,
  renderEvent,
  renderRunFailure,
  type RenderState,
} from "./renderer.js";
import { writeLastConversation } from "./conversation.js";
import { AGENTIC_TENANT_LOCK, parseSlash, type SlashState } from "./slash.js";

export interface RunReplOptions {
  config: ResolvedConfig;
  client: MiotHarnessClient;
  conversationId?: string;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  noColor?: boolean;
  configDir?: string;
  greet?: boolean;
}

interface SessionState {
  mode: RunMode;
  tenant: string;
  user: string;
  conversationId: string;
  debug: boolean;
  transcript: TranscriptEntry[];
}

interface TranscriptEntry {
  prompt: string;
  runId: string;
  record: HarnessRunRecord | null;
}

export async function runRepl(opts: RunReplOptions): Promise<number> {
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const color: ColorOptions = {
    noColor: opts.noColor ?? Boolean(process.env.NO_COLOR),
    isTTY: "isTTY" in stdout ? (stdout as { isTTY?: boolean }).isTTY : false,
  };

  const session: SessionState = {
    mode: opts.config.mode,
    tenant: opts.config.tenantId,
    user: opts.config.userId,
    conversationId: opts.conversationId ?? randomUUID(),
    debug: opts.config.debug,
    transcript: [],
  };

  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  let currentAbort: AbortController | null = null;
  let exitCode = 0;

  rl.on("SIGINT", () => {
    if (currentAbort) {
      currentAbort.abort();
      stdout.write(`${CLEAR_LINE}${dim("aborted.", color)}\n`);
    }
  });

  if (opts.greet !== false) {
    stdout.write(
      `${dim(`miot-chat → ${opts.config.baseUrl} (${session.mode} / ${session.tenant})`, color)}\n`,
    );
    stdout.write(`${dim(`conversation: ${session.conversationId}`, color)}\n`);
    warnIfAgenticMismatch(session, color, stdout);
  }

  const promptFn = () => promptFor(session, color);
  rl.setPrompt(promptFn());

  try {
    for await (const line of iterateLines(rl, stdout, promptFn)) {
      const slashAction = parseSlash(line, slashStateOf(session));

      if (slashAction.kind === "noop" && line.trim().length === 0) {
        continue;
      }

      if (slashAction.kind === "exit") {
        try {
          writeLastConversation(session.conversationId, opts.configDir);
        } catch (e) {
          stderr.write(
            `${red(`could not persist last conversation: ${describeError(e)}`, color)}\n`,
          );
        }
        break;
      }

      if (slashAction.kind === "reset") {
        session.conversationId = randomUUID();
        session.transcript = [];
        stdout.write(
          `${dim(`new conversation: ${session.conversationId}`, color)}\n`,
        );
        rl.setPrompt(promptFn());
        continue;
      }

      if (slashAction.kind === "set-mode") {
        session.mode = slashAction.mode;
        stdout.write(`${dim(`mode = ${session.mode}`, color)}\n`);
        if (slashAction.warnAgenticTenantMismatch) {
          stdout.write(
            `${yellow(`heads-up: agentic mode is gated to tenant '${AGENTIC_TENANT_LOCK}'; current tenant is '${session.tenant}'.`, color)}\n`,
          );
        }
        rl.setPrompt(promptFn());
        continue;
      }

      if (slashAction.kind === "set-tenant") {
        session.tenant = slashAction.tenant;
        stdout.write(`${dim(`tenant = ${session.tenant}`, color)}\n`);
        if (slashAction.warnAgenticTenantMismatch) {
          stdout.write(
            `${yellow(`heads-up: agentic mode is gated to tenant '${AGENTIC_TENANT_LOCK}'; this run will be denied.`, color)}\n`,
          );
        }
        rl.setPrompt(promptFn());
        continue;
      }

      if (slashAction.kind === "save") {
        try {
          writeFileSync(
            slashAction.path,
            JSON.stringify(
              {
                conversation_id: session.conversationId,
                transcript: session.transcript,
              },
              null,
              2,
            ),
            { encoding: "utf-8" },
          );
          stdout.write(`${dim(`saved transcript to ${slashAction.path}`, color)}\n`);
        } catch (e) {
          stderr.write(
            `${red(`save failed: ${describeError(e)}`, color)}\n`,
          );
        }
        continue;
      }

      if (slashAction.kind === "invalid") {
        stderr.write(`${red(slashAction.reason, color)}\n`);
        continue;
      }

      currentAbort = new AbortController();
      try {
        await runOneTurn(line, session, opts.client, {
          color,
          stdout,
          stderr,
          signal: currentAbort.signal,
        });
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") {
          // SIGINT already wrote the aborted notice
        } else if (e instanceof MiotHarnessApiError) {
          stderr.write(`${red(`error: ${e.message}`, color)}\n`);
          exitCode = 1;
        } else {
          stderr.write(`${red(`unexpected: ${describeError(e)}`, color)}\n`);
          exitCode = 1;
        }
      } finally {
        currentAbort = null;
      }
    }
  } finally {
    rl.close();
  }
  return exitCode;
}

interface TurnContext {
  color: ColorOptions;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  signal: AbortSignal;
}

async function runOneTurn(
  prompt: string,
  session: SessionState,
  client: MiotHarnessClient,
  ctx: TurnContext,
): Promise<void> {
  const req: UserRequest = {
    message: prompt,
    tenant_id: session.tenant,
    user_id: session.user,
    mode: session.mode,
    conversation_id: session.conversationId,
    ...(session.debug ? { debug: true } : {}),
  };

  const { run_id } = await client.runs.create(req, { signal: ctx.signal });
  let state: RenderState = initialState(ctx.color);
  let terminal: "completed" | "failed" | null = null;
  let failureMessage = "";
  const seenEvents: HarnessEvent[] = [];

  for await (const event of client.runs.stream(run_id, { signal: ctx.signal })) {
    seenEvents.push(event);
    const r = renderEvent(state, event);
    state = r.state;
    if (r.output.length > 0) ctx.stdout.write(r.output);
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

  if (terminal === "completed") {
    let record: HarnessRunRecord | null = null;
    try {
      record = await client.runs.get(run_id);
    } catch {
      record = null;
    }
    const finalRender = renderAuthoritativeAnswer(state, record?.answer ?? null);
    ctx.stdout.write(finalRender.output);
    session.transcript.push({ prompt, runId: run_id, record });
    return;
  }

  if (terminal === "failed") {
    const failureRender = renderRunFailure(state, failureMessage);
    ctx.stdout.write(failureRender.output);
    session.transcript.push({ prompt, runId: run_id, record: null });
    return;
  }

  // The SSE stream ended without ever emitting run.completed or
  // run.failed. Treat this as an error and let the caller's catch
  // surface it + flip exitCode to 1 via the existing "unexpected:"
  // branch. Throwing keeps runOneTurn's Promise<void> signature.
  throw new Error("stream ended without a terminal event");
}

function slashStateOf(s: SessionState): SlashState {
  return { mode: s.mode, tenant: s.tenant };
}

function promptFor(s: SessionState, color: ColorOptions): string {
  const tag = `${s.conversationId.slice(0, 6)}:${s.mode}`;
  return `${dim(`[${tag}]`, color)} > `;
}

function warnIfAgenticMismatch(
  s: SessionState,
  color: ColorOptions,
  out: NodeJS.WritableStream,
): void {
  if (s.mode === "agentic" && s.tenant !== AGENTIC_TENANT_LOCK) {
    out.write(
      `${yellow(`heads-up: agentic mode is gated to tenant '${AGENTIC_TENANT_LOCK}'; current tenant is '${s.tenant}'.`, color)}\n`,
    );
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function* iterateLines(
  rl: ReadlineInterface,
  stdout: NodeJS.WritableStream,
  prompt: () => string,
): AsyncIterable<string> {
  stdout.write(prompt());
  for await (const line of rl) {
    yield line;
    stdout.write(prompt());
  }
}

// Re-exported so callers can compose bold/etc. consistently with the loop.
export { bold };

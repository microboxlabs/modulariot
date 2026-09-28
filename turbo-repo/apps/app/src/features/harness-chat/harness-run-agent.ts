"use client";

import {
  HttpAgent,
  runHttpRequest,
  transformHttpEventStream,
  type HttpAgentConfig,
  type Message,
  type RunAgentInput,
} from "@ag-ui/client";
import type { RunEffort } from "@microboxlabs/miot-harness-client";
import { readRunEffort } from "./hooks/use-run-effort";
import { attachmentMarker, attachmentOfPart } from "./attachment-parts";
import {
  HARNESS_RUN_EVENT,
  announceRunMarker,
  cancelRun,
  clearActiveRun,
  fetchRunStatus,
  isHarnessRunMarker,
  resumeRunUrl,
  writeActiveRun,
} from "./harness-active-run";
import { STREAM_IDLE_MS, sseFrame, watchIdle } from "./stream-watchdog";

/**
 * Messages kept in a run request, counted from the end. The relay reads the
 * last user message and rebuilds the harness's conversation history from the
 * text turns before it, capped at 20 turns; anything older is never looked at.
 */
const MAX_UPLOAD_MESSAGES = 60;

/**
 * The runtime sends the whole transcript with every run — reasoning
 * narration, inlined attachments and all — and the relay reads little of it.
 * This sends what it does read: the user and assistant text, the tool
 * exchanges that steer a run, the files on the message being answered, and
 * only the recent part of it.
 */
export class HarnessRunAgent extends HttpAgent {
  /** The conversation model the user picked; null asks for the default.
   * Sent with every run in state, next to the conversation id. */
  model: string | null = null;

  /** A trainer's learning session; the relay expands its `/review` and
   * shows its workspace cards. */
  learning = false;

  /** The harness run behind this thread's current or last run. */
  harnessRunId: string | null = null;

  /** When set, the next run re-attaches to this harness run instead of
   * starting a new one. */
  resumeRunId: string | null = null;

  /** When the harness started the current run (epoch ms), once known. */
  runStartedAt: number | null = null;

  /** Called when a run's stream went silent while its harness run may still
   * have an answer: the caller re-attaches to it once this run has ended. */
  onReattach: ((harnessRunId: string) => void) | null = null;

  private readonly clockListeners = new Set<() => void>();

  constructor(config: HttpAgentConfig) {
    super(config);
    const fetchStream = this.fetch;
    this.fetch = (url, init) => fetchStream(url, init).then((res) => this.watched(res));
    this.subscribe({
      onCustomEvent: ({ event }) => this.onRunMarker(event.name, event.value),
    });
  }

  override run(input: RunAgentInput): ReturnType<HttpAgent["run"]> {
    const resumeRunId = this.resumeRunId;
    this.resumeRunId = null;
    this.harnessRunId = resumeRunId;
    this.setRunStartedAt(null);
    if (!resumeRunId) {
      return super.run(
        withLearning(
          withEffort(withModel(trimRunInput(input), this.model), readRunEffort()),
          this.learning
        )
      );
    }
    const url = resumeRunUrl(resumeRunId, this.threadId, input.runId);
    return transformHttpEventStream(
      runHttpRequest(() =>
        this.fetch(url, {
          method: "GET",
          headers: { ...this.headers, Accept: "text/event-stream" },
          signal: this.abortController.signal,
        })
      ),
      this.debugLogger
    );
  }

  /** Stop. Aborting the request only stops the relay; this cancels the
   * harness run itself. */
  cancelHarnessRun(): void {
    const runId = this.harnessRunId;
    if (!runId) return;
    clearActiveRun(this.threadId, runId);
    void cancelRun(runId);
  }

  subscribeClock = (listener: () => void): (() => void) => {
    this.clockListeners.add(listener);
    return () => this.clockListeners.delete(listener);
  };

  private setRunStartedAt(value: number | null): void {
    if (this.runStartedAt === value) return;
    this.runStartedAt = value;
    for (const listener of this.clockListeners) listener();
  }

  private onRunMarker(name: string, value: unknown): void {
    if (name !== HARNESS_RUN_EVENT || !isHarnessRunMarker(value)) return;
    if (value.status === "running") {
      this.harnessRunId = value.runId;
      writeActiveRun(this.threadId, value.runId);
      const startedAt = value.startedAt ? Date.parse(value.startedAt) : Number.NaN;
      if (!Number.isNaN(startedAt)) this.setRunStartedAt(startedAt);
    } else {
      clearActiveRun(this.threadId, value.runId);
    }
    announceRunMarker(this.threadId, value);
  }

  private watched(res: Response): Response {
    if (!res.ok || !res.body) return res;
    return new Response(watchIdle(res.body, STREAM_IDLE_MS, () => this.onStreamIdle()), {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }

  /** The stream went silent: a run the harness failed or lost ends here as
   * interrupted; one it may still hold is re-attached to. */
  private async onStreamIdle(): Promise<string> {
    const runId = this.harnessRunId;
    const status = runId ? await fetchRunStatus(runId) : "unknown";
    if (!runId || status === "failed" || status === "unknown") {
      if (runId) clearActiveRun(this.threadId, runId);
      return sseFrame({ type: "RUN_ERROR", message: "interrupted" });
    }
    this.onReattach?.(runId);
    return sseFrame({ type: "RUN_ERROR", message: "stream_lost" });
  }
}

export function withModel(
  input: RunAgentInput,
  model: string | null
): RunAgentInput {
  return withStateField(input, "harnessModel", model);
}

export function withEffort(
  input: RunAgentInput,
  effort: RunEffort | null
): RunAgentInput {
  return withStateField(input, "harnessEffort", effort);
}

export function withLearning(
  input: RunAgentInput,
  learning: boolean
): RunAgentInput {
  return withStateField(input, "harnessLearning", learning ? "true" : null);
}

function withStateField(
  input: RunAgentInput,
  key: string,
  value: string | null
): RunAgentInput {
  if (value) return { ...input, state: { ...input.state, [key]: value } };
  if (!input.state || !(key in input.state)) return input;
  const state = { ...input.state };
  delete state[key];
  return { ...input, state };
}

export function trimRunInput(input: RunAgentInput): RunAgentInput {
  const kept = input.messages.filter(
    (message) => message.role !== "reasoning" && message.role !== "activity",
  );
  const lastUser = kept.findLastIndex((message) => message.role === "user");
  const messages = kept
    .map((message, i) => (i === lastUser ? withFiles(message) : textOnly(message)))
    .slice(-MAX_UPLOAD_MESSAGES);
  return { ...input, messages };
}

type UserContent = Extract<Message, { role: "user" }>["content"];

function textOf(content: Exclude<UserContent, string>): string {
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** An earlier user message goes as its text, with a marker for each file it
 * carried: the model has seen those files, and the relay replays only text. */
function textOnly(message: Message): Message {
  if (message.role !== "user" || !Array.isArray(message.content)) return message;
  const markers = message.content.flatMap((part) => {
    const file = attachmentOfPart(part);
    return file ? [attachmentMarker(file)] : [];
  });
  const content = [...markers, textOf(message.content)].filter(Boolean).join("\n");
  return { ...message, content };
}

/** The message being answered keeps its files, for the relay to hand to the
 * harness; everything else in it goes as one text part. */
function withFiles(message: Message): Message {
  if (message.role !== "user" || !Array.isArray(message.content)) return message;
  const files = message.content.filter((part) => attachmentOfPart(part) !== null);
  if (files.length === 0) return { ...message, content: textOf(message.content) };
  return { ...message, content: [{ type: "text", text: textOf(message.content) }, ...files] };
}

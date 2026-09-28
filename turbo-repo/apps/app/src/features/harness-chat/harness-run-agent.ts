"use client";

import {
  HttpAgent,
  runHttpRequest,
  transformHttpEventStream,
  type HttpAgentConfig,
  type Message,
  type RunAgentInput,
} from "@ag-ui/client";
import {
  HARNESS_RUN_EVENT,
  cancelRun,
  clearActiveRun,
  isHarnessRunMarker,
  resumeRunUrl,
  writeActiveRun,
} from "./harness-active-run";

/**
 * Messages kept in a run request, counted from the end. The relay reads the
 * last user message and rebuilds the harness's conversation history from the
 * text turns before it, capped at 20 turns; anything older is never looked at.
 */
const MAX_UPLOAD_MESSAGES = 60;

/**
 * The runtime sends the whole transcript with every run — reasoning
 * narration, inlined attachments and all — and the relay reads none of that.
 * This sends what it does read: the user and assistant text, the tool
 * exchanges that steer a run, and only the recent part of it.
 */
export class HarnessRunAgent extends HttpAgent {
  /** The conversation model the user picked; null asks for the default.
   * Sent with every run in state, next to the conversation id. */
  model: string | null = null;

  /** The harness run behind this thread's current or last run. */
  harnessRunId: string | null = null;

  /** When set, the next run re-attaches to this harness run instead of
   * starting a new one. */
  resumeRunId: string | null = null;

  constructor(config: HttpAgentConfig) {
    super(config);
    this.subscribe({
      onCustomEvent: ({ event }) => this.onRunMarker(event.name, event.value),
    });
  }

  override run(input: RunAgentInput): ReturnType<HttpAgent["run"]> {
    const resumeRunId = this.resumeRunId;
    this.resumeRunId = null;
    this.harnessRunId = resumeRunId;
    if (!resumeRunId) return super.run(withModel(trimRunInput(input), this.model));
    const url = resumeRunUrl(resumeRunId, this.threadId, input.runId);
    return transformHttpEventStream(
      runHttpRequest(() =>
        this.fetch(url, {
          method: "GET",
          headers: { ...this.headers, Accept: "text/event-stream" },
          signal: this.abortController.signal,
        }),
      ),
      this.debugLogger,
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

  private onRunMarker(name: string, value: unknown): void {
    if (name !== HARNESS_RUN_EVENT || !isHarnessRunMarker(value)) return;
    if (value.status === "running") {
      this.harnessRunId = value.runId;
      writeActiveRun(this.threadId, value.runId);
    } else {
      clearActiveRun(this.threadId, value.runId);
    }
  }
}

export function withModel(input: RunAgentInput, model: string | null): RunAgentInput {
  if (model) return { ...input, state: { ...input.state, harnessModel: model } };
  if (!input.state || !("harnessModel" in input.state)) return input;
  const state = { ...input.state };
  delete state.harnessModel;
  return { ...input, state };
}

export function trimRunInput(input: RunAgentInput): RunAgentInput {
  const messages = input.messages
    .filter((message) => message.role !== "reasoning" && message.role !== "activity")
    .map(textOnly)
    .slice(-MAX_UPLOAD_MESSAGES);
  return { ...input, messages };
}

/** A user message with attachments carries them as binary parts, up to the
 * 20 MB the PDF adapter inlines; the relay only ever reads the text. */
function textOnly(message: Message): Message {
  if (message.role !== "user" || !Array.isArray(message.content)) return message;
  const text = message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return { ...message, content: text };
}

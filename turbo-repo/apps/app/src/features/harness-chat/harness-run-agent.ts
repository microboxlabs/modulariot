"use client";

import {
  HttpAgent,
  type HttpAgentConfig,
  type Message,
  type RunAgentInput,
} from "@ag-ui/client";
import type { RunEffort } from "@microboxlabs/miot-harness-client";
import { readRunEffort } from "./hooks/use-run-effort";
import { attachmentMarker, attachmentOfPart } from "./attachment-parts";

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
  constructor(config: HttpAgentConfig) {
    super(config);
  }

  override run(input: RunAgentInput): ReturnType<HttpAgent["run"]> {
    return super.run(
      withEffort(withModel(trimRunInput(input), this.model), readRunEffort())
    );
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

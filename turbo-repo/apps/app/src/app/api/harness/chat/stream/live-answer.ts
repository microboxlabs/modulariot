import {
  getPartialJsonObjectFieldState,
  parsePartialJsonObject,
} from "assistant-stream/utils";
import { blockText, toChatBlock, type ChatEvent } from "./chat-answer";

/**
 * The readable text of an answer still being written: the text itself, or,
 * for a block array, the text of its blocks as `chatAnswerEvents` joins it.
 * A block still being written counts only when it is markdown, whose text
 * only grows. Null while the array cannot be read yet.
 */
export function readableAnswer(raw: string): string | null {
  const text = raw.trimStart();
  if (!text.startsWith("[")) return text;
  // The parser reads objects only, so the array is read as a field of one.
  const parsed = parsePartialJsonObject(`{"blocks":${text}`);
  const items: unknown = parsed?.blocks;
  if (!parsed || !Array.isArray(items)) return null;
  const parts: string[] = [];
  items.forEach((item, i) => {
    const complete =
      getPartialJsonObjectFieldState(parsed, ["blocks", i]) === "complete";
    const block = toChatBlock(item);
    if (!block) return;
    if (
      !complete &&
      (block.type !== "markdown" ||
        getPartialJsonObjectFieldState(parsed, ["blocks", i, "type"]) !==
          "complete")
    ) {
      return;
    }
    const part = blockText(block);
    if (part !== null) parts.push(part);
  });
  return parts.join("\n\n");
}

/** The text of an answer's events, its messages joined as one. */
function answerText(events: ChatEvent[]): string {
  return events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => String(e.delta ?? ""))
    .join("\n\n");
}

const TEXT_EVENTS: ReadonlySet<unknown> = new Set([
  "TEXT_MESSAGE_START",
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_END",
]);

/**
 * Streams the answer's text as `answer.delta` events bring it, as one text
 * message that only grows, then merges the run's final answer into it.
 */
export class LiveAnswer {
  private raw = "";
  private shown = "";
  private messageId: string | null = null;

  constructor(
    private readonly send: (event: ChatEvent) => void,
    private readonly newId: () => string = () => crypto.randomUUID()
  ) {}

  get text(): string {
    return this.shown;
  }

  push(delta: string): void {
    this.raw += delta;
    const text = readableAnswer(this.raw)?.trimEnd();
    if (!text || text === this.shown || !text.startsWith(this.shown)) return;
    this.write(text.slice(this.shown.length));
    this.shown = text;
  }

  /** The text so far belonged to a turn that went on to call tools: it
   * stays, and the next answer text starts a new message. */
  restart(): void {
    this.end();
    this.raw = "";
    this.shown = "";
  }

  end(): void {
    if (!this.messageId) return;
    this.send({ type: "TEXT_MESSAGE_END", messageId: this.messageId });
    this.messageId = null;
  }

  /**
   * Sends the final answer's events. When the streamed text is the start of
   * the final text, the rest is appended to it and only the cards follow;
   * otherwise the streamed message is closed and the answer sent in full.
   * Returns false in that second case.
   */
  settle(events: ChatEvent[]): boolean {
    const final = answerText(events);
    const streamed = this.shown !== "";
    const merged = streamed && final.startsWith(this.shown);
    if (merged) {
      const rest = final.slice(this.shown.length);
      if (rest) this.write(rest);
      this.shown = final;
    }
    this.end();
    for (const event of events) {
      if (!merged || !TEXT_EVENTS.has(event.type)) this.send(event);
    }
    return merged || !streamed;
  }

  private write(delta: string): void {
    if (!this.messageId) {
      this.messageId = this.newId();
      this.send({ type: "TEXT_MESSAGE_START", messageId: this.messageId });
    }
    this.send({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: this.messageId,
      delta,
    });
  }
}

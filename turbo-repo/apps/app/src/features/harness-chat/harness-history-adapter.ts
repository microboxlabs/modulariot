"use client";

import {
  ExportedMessageRepository,
  type ExportedMessageRepositoryItem,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import {
  AUI_MESSAGE_FORMAT,
  appendMessage,
  listMessages,
  type StoredMessage,
} from "./harness-thread-store";

/** One prior exchange, in the shape the harness accepts as replayed context. */
export type ReplayTurn = { user_message: string; assistant_answer: string };

/**
 * How many turns a reloaded thread replays to the harness. The harness keeps
 * conversations in memory, so a thread it has forgotten needs its context
 * handed back; it caps and token-trims what it accepts, and this bounds what
 * we put on the wire in the first place.
 */
const MAX_REPLAY_TURNS = 20;

/**
 * Anything longer is assumed to be inline content rather than a reference and
 * is dropped when persisting. The PDF attachment adapter inlines up to 20 MB
 * as a data URL; a transcript is not a blob store, and the upstream row cap is
 * 256 KB for the whole message.
 */
const MAX_INLINE_LENGTH = 2048;

/**
 * Persists one thread's messages and hands them back on reload.
 *
 * `useAgUiRuntime` drives this on its own: `load()` runs when the thread
 * mounts and its result seeds both the transcript and the AG-UI state, and
 * `append()` runs for every message that reaches a persistable status.
 *
 * Storage failures are swallowed. Losing a message from the transcript is
 * worse handled by breaking the chat than by forgetting it, and forgetting is
 * exactly what the panel did before it had any storage at all.
 */
export function createHarnessHistoryAdapter(threadId: string): ThreadHistoryAdapter {
  return {
    async load() {
      // A thread with no stored messages still carries its id: that is what
      // the harness groups its runs by, and it has to be in state before the
      // first run of a reopened chat.
      const empty = {
        messages: [],
        state: { harnessConversationId: threadId, harnessReplayTurns: [] },
      };
      const stored = await listMessages(threadId);
      if (!stored?.length) return empty;

      const items = stored
        .filter((row) => row.format === AUI_MESSAGE_FORMAT)
        .map((row) => ({
          parentId: row.parentId,
          message: reviveMessage(row.payload),
        }))
        .filter((item): item is { parentId: string | null; message: ThreadMessage } =>
          item.message !== null,
        );
      if (items.length === 0) return empty;

      const headId = items.at(-1)?.message.id ?? null;
      const repository = ExportedMessageRepository.fromBranchableArray(items, { headId });

      return {
        ...repository,
        // Both fields ride the same AG-UI state the chat route reads. The
        // route's own STATE_SNAPSHOT at the end of a run replaces this object
        // with the conversation id alone, which is what keeps the replay to
        // the first run after a reload instead of every turn.
        state: {
          harnessConversationId: threadId,
          harnessReplayTurns: toReplayTurns(activeBranch(items, headId)),
        },
      };
    },

    async append(item: ExportedMessageRepositoryItem) {
      await appendMessage(threadId, toStoredMessage(item));
    },

    async update(item: ExportedMessageRepositoryItem) {
      // Upserts on the message id upstream, so the same call covers both.
      await appendMessage(threadId, toStoredMessage(item));
    },
  };
}

function toStoredMessage(item: ExportedMessageRepositoryItem): StoredMessage {
  return {
    id: item.message.id,
    parentId: item.parentId,
    format: AUI_MESSAGE_FORMAT,
    payload: stripInlineContent(item.message) as unknown as Record<string, unknown>,
  };
}

/**
 * Drops inlined attachment bodies from a message before it is stored. A
 * reloaded thread shows the exchange without the file the user attached —
 * keeping a 20 MB data URL per message to redraw a PDF thumbnail is not a
 * trade worth making, and the answer that discussed it is what people come
 * back for.
 *
 * The part goes rather than its body: an image part with an empty `image`
 * renders as a broken image, and a file part with empty `data` renders as a
 * link to the current page. With no part left, the attachment renders as what
 * it now is — a name, and nothing to open.
 */
export function stripInlineContent<T>(message: T): T {
  return pruneDeep(message, (value) => {
    if (!isRecord(value)) return false;
    const body = value.type === "image" ? value.image : value.type === "file" ? value.data : null;
    if (typeof body !== "string") return false;
    return body.startsWith("data:") || body.length > MAX_INLINE_LENGTH;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Pairs each user message with the answer that followed it. Only text parts
 * carry over: the harness's conversation memory is a list of
 * {user_message, assistant_answer} strings, and tool calls or cards have no
 * place in it.
 */
export function toReplayTurns(
  messages: readonly ThreadMessage[],
  maxTurns = MAX_REPLAY_TURNS,
): ReplayTurn[] {
  const turns: ReplayTurn[] = [];
  let pendingUser: string | null = null;

  for (const message of messages) {
    const text = textOf(message);
    if (message.role === "user") {
      // Two user messages in a row (the first got no answer): the later one
      // is the question the assistant actually replied to.
      pendingUser = text || pendingUser;
    } else if (message.role === "assistant" && pendingUser && text) {
      turns.push({ user_message: pendingUser, assistant_answer: text });
      pendingUser = null;
    }
  }

  return turns.slice(-maxTurns);
}

/**
 * The messages actually on the branch ending at `headId`, oldest first.
 *
 * Editing a message or reloading an answer forks the thread, and every fork
 * stays in storage. Replaying all of it would hand the harness abandoned
 * questions and superseded answers as though the conversation had contained
 * them.
 */
export function activeBranch(
  items: readonly { parentId: string | null; message: ThreadMessage }[],
  headId: string | null,
): ThreadMessage[] {
  if (!headId) return [];
  const byId = new Map(items.map((item) => [item.message.id, item]));
  const branch: ThreadMessage[] = [];
  const seen = new Set<string>();

  let cursor: string | null = headId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const item = byId.get(cursor);
    if (!item) break;
    branch.push(item.message);
    cursor = item.parentId;
  }

  return branch.reverse();
}

function textOf(message: ThreadMessage): string {
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part): part is { type: "text"; text: string } => part?.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

/**
 * Turns a stored payload back into a message. `createdAt` is the one field
 * JSON cannot round-trip — it goes out as a Date and comes back as a string,
 * and the runtime never coerces it.
 */
function reviveMessage(payload: Record<string, unknown>): ThreadMessage | null {
  if (!payload || typeof payload !== "object" || typeof payload.id !== "string") {
    return null;
  }
  return {
    ...payload,
    createdAt: reviveDate(payload.createdAt),
  } as unknown as ThreadMessage;
}

function reviveDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

/** Rebuilds a value, dropping every array entry `drop` selects. */
function pruneDeep<T>(value: T, drop: (entry: unknown) => boolean): T {
  if (Array.isArray(value)) {
    return value.filter((entry) => !drop(entry)).map((entry) => pruneDeep(entry, drop)) as T;
  }
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = pruneDeep(entry, drop);
  }
  return out as unknown as T;
}

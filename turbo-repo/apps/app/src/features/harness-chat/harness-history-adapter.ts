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
  getThread,
  listMessages,
  type StoredMessage,
} from "./harness-thread-store";

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
      const [thread, stored] = await Promise.all([getThread(threadId), listMessages(threadId)]);
      // Both fields ride the AG-UI state the chat route reads with every run.
      // The id is what the harness groups its runs by, so it has to be in
      // state before the first run of a reopened chat, stored messages or
      // not. The summary is what the harness compacted older turns into: the
      // runtime sends the recent transcript itself, but a restarted harness
      // has no other way to get the part before it. The route's own
      // STATE_SNAPSHOT at the end of each run refreshes this object.
      const state = {
        harnessConversationId: threadId,
        harnessConversationSummary: thread?.summary ?? null,
      };
      const empty = { messages: [], state };
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
      return { ...ExportedMessageRepository.fromBranchableArray(items, { headId }), state };
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
    const body = attachmentBody(value);
    if (body === null) return false;
    return body.startsWith("data:") || body.length > MAX_INLINE_LENGTH;
  });
}

/** The inlined body of an image or file part, if that is what this is. */
function attachmentBody(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const body = value.type === "image" ? value.image : value.data;
  if (value.type !== "image" && value.type !== "file") return null;
  return typeof body === "string" ? body : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

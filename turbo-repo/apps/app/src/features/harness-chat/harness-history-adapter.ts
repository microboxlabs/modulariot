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
import { clearActiveRun, readActiveRun } from "./harness-active-run";

/**
 * Anything longer is assumed to be inline content rather than a reference and
 * is dropped when persisting. The PDF attachment adapter inlines up to 20 MB
 * as a data URL; a transcript is not a blob store, and the upstream row cap is
 * 256 KB for the whole message.
 */
const MAX_INLINE_LENGTH = 2048;

export type HarnessHistoryAdapter = ThreadHistoryAdapter & {
  /** The harness run `load()` found still going, for the caller to re-attach
   * to once the transcript is in; null when there is none or it was taken. */
  takePendingResume(): string | null;
};

type HistoryItem = { parentId: string | null; message: ThreadMessage };

/**
 * Persists one thread's messages and hands them back on reload.
 *
 * `useAgUiRuntime` drives this on its own: `load()` runs when the thread
 * mounts and its result seeds both the transcript and the AG-UI state, and
 * `append()` runs for every message that reaches a persistable status.
 *
 * Each assistant message is stored with the harness run that produced it
 * (`metadata.custom.harnessRunId`). A reload in the middle of a run finds
 * that run in `harness-active-run`; the answer it left half-written, if one
 * was stored, is dropped from the transcript, and the re-attached run's
 * answer is stored over it.
 *
 * Storage failures are swallowed. Losing a message from the transcript is
 * worse handled by breaking the chat than by forgetting it, and forgetting is
 * exactly what the panel did before it had any storage at all.
 */
export function createHarnessHistoryAdapter(
  threadId: string,
  runs: { readonly harnessRunId: string | null } = { harnessRunId: null },
): HarnessHistoryAdapter {
  let pendingResume: string | null = null;
  // Fixed the first time a message is stored, so a later rewrite of it does
  // not pick up whatever run is current by then.
  const runOfMessage = new Map<string, string | null>();
  // The stored id of the half-written answer a re-attached run replaces.
  const replacedByRun = new Map<string, string>();
  const storedIds = new Map<string, string>();

  const toStoredMessage = (item: ExportedMessageRepositoryItem): StoredMessage => {
    const { message } = item;
    let runId: string | null = null;
    if (message.role === "assistant") {
      if (!runOfMessage.has(message.id)) runOfMessage.set(message.id, runs.harnessRunId);
      runId = runOfMessage.get(message.id) ?? null;
      const replaced = runId ? replacedByRun.get(runId) : undefined;
      if (replaced) storedIds.set(message.id, replaced);
    }
    const id = storedIds.get(message.id) ?? message.id;
    const parentId = item.parentId && (storedIds.get(item.parentId) ?? item.parentId);
    const payload = stripInlineContent({
      ...message,
      id,
      ...(runId && {
        metadata: {
          ...message.metadata,
          custom: { ...message.metadata?.custom, harnessRunId: runId },
        },
      }),
    }) as unknown as Record<string, unknown>;
    return { id, parentId, format: AUI_MESSAGE_FORMAT, payload };
  };

  const planResume = (items: HistoryItem[]): HistoryItem[] => {
    const activeRunId = readActiveRun(threadId);
    if (!activeRunId || items.length === 0) return items;
    const head = items.at(-1)?.message;
    if (head?.role === "assistant" && harnessRunIdOf(head) === activeRunId) {
      if (head.status?.type === "complete") {
        clearActiveRun(threadId, activeRunId);
        return items;
      }
      replacedByRun.set(activeRunId, head.id);
      pendingResume = activeRunId;
      return items.slice(0, -1);
    }
    pendingResume = activeRunId;
    return items;
  };

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

      const items = planResume(
        stored
          .filter((row) => row.format === AUI_MESSAGE_FORMAT)
          .map((row) => ({
            parentId: row.parentId,
            message: reviveMessage(row.payload),
          }))
          .filter((item): item is HistoryItem => item.message !== null),
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

    takePendingResume() {
      const runId = pendingResume;
      pendingResume = null;
      return runId;
    },
  };
}

function harnessRunIdOf(message: ThreadMessage): string | null {
  const runId = message.metadata?.custom?.harnessRunId;
  return typeof runId === "string" ? runId : null;
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

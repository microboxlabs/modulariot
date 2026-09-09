"use client";

/**
 * Client for the chat panel's persisted threads. Everything goes through the
 * app's own `/api/harness/threads` routes, which attach the session token and
 * the active org — the browser never talks to the modulith directly.
 *
 * Storage is treated as best-effort throughout: a panel that cannot reach it
 * still works, it just forgets on reload, which is what it did before any of
 * this existed. Callers get `null`/`[]` rather than exceptions for that reason.
 */

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/threads`;

/** Payload shape tag stored with every message. A future assistant-ui change
 * that alters the serialized message gets a new tag, and this client skips
 * what it does not recognize instead of feeding the runtime something it
 * cannot decode. */
export const AUI_MESSAGE_FORMAT = "aui-v1";

export type StoredThread = {
  id: string;
  title: string | null;
  /** The harness's compacted memory of the conversation; null until it compacts. */
  summary: string | null;
  ownerId: string;
  owned: boolean;
  expiresAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
};

export type StoredMessage = {
  id: string;
  parentId: string | null;
  format: string;
  payload: Record<string, unknown>;
  /** Append position, and the cursor a page continues from. Absent on a
   * message this client is sending. */
  seq?: number;
};

/** One read of a thread's messages fetches at most this many; a shorter
 * page is the last one. Matches the store's own default. */
const MESSAGE_PAGE = 500;

export async function listThreads(signal?: AbortSignal): Promise<StoredThread[] | null> {
  const res = await fetch(BASE, { signal }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as StoredThread[] | null;
}

export async function createThread(
  thread: { id: string; title?: string | null; expiresAt?: string | null },
): Promise<StoredThread | null> {
  return postJson<StoredThread>(BASE, thread);
}

export async function getThread(id: string, signal?: AbortSignal): Promise<StoredThread | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { signal }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as StoredThread | null;
}

export async function renameThread(id: string, title: string): Promise<void> {
  await sendJson(`${BASE}/${encodeURIComponent(id)}`, "PATCH", { title });
}

/** `null` expiry means "never" and has to say so explicitly — a missing field
 * is "leave it alone" upstream. */
export async function setThreadExpiry(id: string, expiresAt: string | null): Promise<void> {
  await sendJson(`${BASE}/${encodeURIComponent(id)}`, "PATCH", {
    expiresAt,
    clearExpiry: expiresAt === null,
  });
}

export async function setThreadSummary(id: string, summary: string): Promise<boolean> {
  return sendJson(`${BASE}/${encodeURIComponent(id)}`, "PATCH", { summary });
}

export async function deleteThread(id: string): Promise<void> {
  await sendJson(`${BASE}/${encodeURIComponent(id)}`, "DELETE");
}

/** Every message of the thread, read a page at a time. A page that cannot
 * be read fails the whole load: a transcript with a hole in it has messages
 * whose parent is missing, which is worse than no transcript. */
export async function listMessages(
  threadId: string,
  signal?: AbortSignal,
): Promise<StoredMessage[] | null> {
  const all: StoredMessage[] = [];
  let after = 0;
  for (;;) {
    const page = await listMessagePage(threadId, after, signal);
    if (page === null) return null;
    all.push(...page);
    const last = page.at(-1);
    if (page.length < MESSAGE_PAGE || typeof last?.seq !== "number") return all;
    after = last.seq;
  }
}

async function listMessagePage(
  threadId: string,
  after: number,
  signal?: AbortSignal,
): Promise<StoredMessage[] | null> {
  const query = `?after=${after}&limit=${MESSAGE_PAGE}`;
  const res = await fetch(`${BASE}/${encodeURIComponent(threadId)}/messages${query}`, { signal })
    .catch(() => null);
  if (!res?.ok) return null;
  const page = (await res.json().catch(() => null)) as StoredMessage[] | null;
  return Array.isArray(page) ? page : null;
}

export async function appendMessage(
  threadId: string,
  message: StoredMessage,
): Promise<boolean> {
  return sendJson(`${BASE}/${encodeURIComponent(threadId)}/messages`, "POST", message);
}

export async function shareThread(threadId: string, principal: string): Promise<boolean> {
  return sendJson(`${BASE}/${encodeURIComponent(threadId)}/shares`, "POST", {
    principal,
    permission: "read",
  });
}

export async function revokeShare(threadId: string, principal: string): Promise<boolean> {
  return sendJson(
    `${BASE}/${encodeURIComponent(threadId)}/shares/${encodeURIComponent(principal)}`,
    "DELETE",
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

async function sendJson(url: string, method: string, body?: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  }).catch(() => null);
  return res?.ok ?? false;
}

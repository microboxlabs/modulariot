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
};

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

export async function deleteThread(id: string): Promise<void> {
  await sendJson(`${BASE}/${encodeURIComponent(id)}`, "DELETE");
}

export async function listMessages(
  threadId: string,
  signal?: AbortSignal,
): Promise<StoredMessage[] | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(threadId)}/messages`, { signal })
    .catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as StoredMessage[] | null;
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

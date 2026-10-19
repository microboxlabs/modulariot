import { modulithHost } from "@/lib/modulith-host";

/**
 * The model a thread last ran on, when the harness still offers it, else
 * null. Used when a run names no model: the first message of a reopened
 * thread can be sent before the panel has restored its picker.
 */
export async function storedThreadModel(
  loadThread: () => Promise<{ model?: unknown } | null>,
  listModels: () => Promise<{ models: string[] }>
): Promise<string | null> {
  try {
    const thread = await loadThread();
    const model =
      typeof thread?.model === "string" && thread.model ? thread.model : null;
    if (!model) return null;
    const offered = await listModels();
    return offered.models.includes(model) ? model : null;
  } catch {
    return null;
  }
}

/** Reads one thread from the modulith as the signed-in user; null when it is not there. */
export async function fetchThread(
  orgSlug: string,
  threadId: string,
  token: string | undefined,
  userEmail: string | undefined
): Promise<{ model?: unknown } | null> {
  const url =
    `${modulithHost()}/api/v1/orgs/${encodeURIComponent(orgSlug)}` +
    `/chat/threads/${encodeURIComponent(threadId)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (userEmail) headers["X-Dev-User-Email"] = userEmail;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) return null;
  return (await res.json()) as { model?: unknown };
}

import type { ClientContext } from "../client.js";
import type { ThreadTitle, ThreadTitleRequest } from "../types.js";

export function createTitlesApi(ctx: ClientContext) {
  return {
    /** A short title for a chat thread from its first exchange (`POST /titles`). */
    create(
      body: ThreadTitleRequest,
      opts?: { signal?: AbortSignal },
    ): Promise<ThreadTitle> {
      return ctx.fetcher("POST", "/titles", { body, signal: opts?.signal });
    },
  };
}

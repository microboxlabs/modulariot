import type { ClientContext } from "../client.js";
import type { SkillSummary } from "../types.js";

const BASE = "/skills";

export function createSkillsApi(ctx: ClientContext) {
  return {
    /**
     * List the skills available to the caller (`GET /skills`) — the data
     * behind a `/skills` picker / autocomplete. `tenant` scopes the result;
     * when omitted the server applies the verified header tenant or its
     * configured default.
     */
    list(opts?: {
      tenant?: string;
      signal?: AbortSignal;
    }): Promise<SkillSummary[]> {
      return ctx.fetcher("GET", BASE, {
        headers: { Accept: "application/json" },
        ...(opts?.tenant !== undefined && { query: { tenant: opts.tenant } }),
        signal: opts?.signal,
      });
    },
  };
}

import type { ClientContext } from "../client.js";
import type { ModelsInfo } from "../types.js";

const BASE = "/models";

export function createModelsApi(ctx: ClientContext) {
  return {
    /**
     * The conversation models a run may name in `model` (`GET /models`).
     * `default` is what an omitted `model` resolves to; both are null/empty
     * when the harness runs the planner graph, which has no per-run model.
     */
    list(opts?: { signal?: AbortSignal }): Promise<ModelsInfo> {
      return ctx.fetcher("GET", BASE, {
        headers: { Accept: "application/json" },
        signal: opts?.signal,
      });
    },
  };
}

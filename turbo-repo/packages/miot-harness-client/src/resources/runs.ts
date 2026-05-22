import type { ClientContext } from "../client.js";
import { MiotHarnessApiError } from "../errors.js";
import { parseSSE } from "../sse.js";
import type {
  ErrorResponse,
  HarnessEvent,
  HarnessRunRecord,
  UserRequest,
} from "../types.js";

const BASE = "/runs";

export function createRunsApi(ctx: ClientContext) {
  return {
    create(
      body: UserRequest,
      opts?: { signal?: AbortSignal },
    ): Promise<{ run_id: string }> {
      return ctx.fetcher("POST", `${BASE}:start`, {
        body,
        headers: { Accept: "application/json" },
        signal: opts?.signal,
      });
    },

    get(
      id: string,
      opts?: { signal?: AbortSignal },
    ): Promise<HarnessRunRecord> {
      return ctx.fetcher("GET", `${BASE}/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json" },
        signal: opts?.signal,
      });
    },

    async *stream(
      id: string,
      opts?: { lastEventId?: string; signal?: AbortSignal },
    ): AsyncIterable<HarnessEvent> {
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (opts?.lastEventId) headers["Last-Event-ID"] = opts.lastEventId;

      const response = await ctx.request(
        "GET",
        `${BASE}/${encodeURIComponent(id)}/stream`,
        { headers, signal: opts?.signal },
      );

      if (!response.ok) {
        let body: ErrorResponse | string;
        try {
          body = (await response.json()) as ErrorResponse;
        } catch {
          body = await response.text().catch(() => "");
        }
        throw new MiotHarnessApiError(
          `http_${response.status}`,
          id,
          body,
          response.status,
        );
      }
      if (response.body == null) {
        throw new MiotHarnessApiError("no_body", id, undefined, response.status);
      }

      for await (const frame of parseSSE(response.body)) {
        if (frame.event === "error") {
          let code = "unknown_error";
          let frameRunId: string | undefined = id;
          try {
            const parsed = JSON.parse(frame.data) as {
              error?: string;
              run_id?: string;
            };
            if (typeof parsed.error === "string") code = parsed.error;
            if (typeof parsed.run_id === "string") frameRunId = parsed.run_id;
          } catch {
            throw new MiotHarnessApiError(
              "unparseable_error",
              id,
              frame.data,
            );
          }
          throw new MiotHarnessApiError(code, frameRunId);
        }
        if (frame.data === "") continue;
        try {
          yield JSON.parse(frame.data) as HarnessEvent;
        } catch {
          throw new MiotHarnessApiError(
            "unparseable_event",
            id,
            `Could not parse SSE data for event=${frame.event ?? "<none>"}`,
          );
        }
      }
    },
  };
}

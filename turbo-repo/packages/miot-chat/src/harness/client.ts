import { parseSSE } from "./sse.js";
import {
  HarnessRunError,
  type HarnessEvent,
  type HarnessRunRecord,
  type UserRequest,
} from "./types.js";

export interface HarnessClientOptions {
  baseUrl: string;
  token?: string | null;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

export interface HarnessClient {
  createRun(
    req: UserRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ run_id: string }>;
  streamRun(
    runId: string,
    opts?: { lastEventId?: string; signal?: AbortSignal },
  ): AsyncIterable<HarnessEvent>;
  getRun(runId: string): Promise<HarnessRunRecord>;
}

export function createHarnessClient(
  options: HarnessClientOptions,
): HarnessClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { ...(options.headers ?? {}) };
    if (options.token) h.Authorization = `Bearer ${options.token}`;
    return h;
  };

  return {
    async createRun(req, opts) {
      const res = await doFetch(`${baseUrl}/runs:start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(req),
        signal: opts?.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HarnessRunError(
          `http_${res.status}`,
          undefined,
          `POST /runs:start failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
        );
      }
      const json = (await res.json()) as { run_id?: string };
      if (typeof json.run_id !== "string") {
        throw new HarnessRunError(
          "invalid_response",
          undefined,
          `POST /runs:start returned no run_id`,
        );
      }
      return { run_id: json.run_id };
    },

    async *streamRun(runId, opts) {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        ...authHeaders(),
      };
      if (opts?.lastEventId) headers["Last-Event-ID"] = opts.lastEventId;

      const res = await doFetch(`${baseUrl}/runs/${encodeURIComponent(runId)}/stream`, {
        method: "GET",
        headers,
        signal: opts?.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HarnessRunError(
          `http_${res.status}`,
          runId,
          `GET /runs/${runId}/stream failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
        );
      }
      if (res.body == null) {
        throw new HarnessRunError(
          "no_body",
          runId,
          `GET /runs/${runId}/stream returned no body`,
        );
      }

      for await (const frame of parseSSE(res.body)) {
        if (frame.event === "error") {
          let code = "unknown_error";
          let frameRunId: string | undefined = runId;
          try {
            const parsed = JSON.parse(frame.data) as {
              error?: string;
              run_id?: string;
            };
            if (typeof parsed.error === "string") code = parsed.error;
            if (typeof parsed.run_id === "string") frameRunId = parsed.run_id;
          } catch {
            // Bad JSON in error frame: fall through with raw text.
            throw new HarnessRunError("unparseable_error", runId, frame.data);
          }
          throw new HarnessRunError(code, frameRunId);
        }
        if (frame.data === "") continue;
        let evt: HarnessEvent;
        try {
          evt = JSON.parse(frame.data) as HarnessEvent;
        } catch {
          throw new HarnessRunError(
            "unparseable_event",
            runId,
            `Could not parse SSE data for event=${frame.event ?? "<none>"}`,
          );
        }
        yield evt;
      }
    },

    async getRun(runId) {
      const res = await doFetch(`${baseUrl}/runs/${encodeURIComponent(runId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeaders(),
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HarnessRunError(
          `http_${res.status}`,
          runId,
          `GET /runs/${runId} failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
        );
      }
      return (await res.json()) as HarnessRunRecord;
    },
  };
}

/**
 * Bridge between Node's `http` module and a fetch-style handler.
 *
 * Node's server API predates `Request`/`Response`, so something has to convert
 * between them. Keeping that conversion here, rather than inside the handler,
 * is what lets the same handler serve a Next route and a standalone process
 * without either knowing about the other.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardHandler } from "../http/handler";

/** Reads the whole body. Requests here are configs and permission lists, not uploads. */
function readBody(request: IncomingMessage): Promise<Buffer | null> {
  const method = (request.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function toRequest(incoming: IncomingMessage, body: Buffer | null): Request {
  const host = incoming.headers.host ?? "localhost";
  const url = new URL(incoming.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  return new Request(url, {
    method: incoming.method ?? "GET",
    headers,
    ...(body && body.length > 0 ? { body: new Uint8Array(body) } : {}),
  });
}

async function writeResponse(
  response: Response,
  outgoing: ServerResponse,
): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  outgoing.writeHead(response.status, headers);
  if (response.body === null) {
    outgoing.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  outgoing.end(buffer);
}

/**
 * Wrap a fetch-style handler as a Node request listener.
 *
 * A handler that throws still has to produce a response: an unhandled
 * rejection here would hang the socket rather than fail the request, which is
 * far worse to diagnose than a 500.
 */
export function toNodeListener(
  handler: DashboardHandler,
  onError?: (error: unknown) => void,
): (incoming: IncomingMessage, outgoing: ServerResponse) => void {
  return (incoming, outgoing) => {
    void (async () => {
      try {
        const body = await readBody(incoming);
        const response = await handler(toRequest(incoming, body));
        await writeResponse(response, outgoing);
      } catch (error) {
        onError?.(error);
        if (!outgoing.headersSent) {
          outgoing.writeHead(500, {
            "content-type": "application/json; charset=utf-8",
          });
        }
        outgoing.end(
          JSON.stringify({
            error: "An unexpected error occurred",
            status: 500,
            code: "INTERNAL_ERROR",
          }),
        );
      }
    })();
  };
}

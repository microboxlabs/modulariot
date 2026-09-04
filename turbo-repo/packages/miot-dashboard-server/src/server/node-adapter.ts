/**
 * Bridge between Node's `http` module and a fetch-style handler.
 *
 * Node's server API predates `Request`/`Response`, so something has to convert
 * between them. Keeping that conversion here, rather than inside the handler,
 * is what lets the same handler serve a Next route and a standalone process
 * without either knowing about the other.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { DashboardServerError, toErrorEnvelope } from "../access/errors";
import type { DashboardHandler } from "../http/handler";

/**
 * How much of a request body this adapter will hold in memory.
 *
 * Requests here are configs and permission lists rather than uploads, but
 * "callers only send what the API is for" is an assumption about well-behaved
 * clients, not a control. Without a cap, one connection sending an endless
 * body grows the chunk array until the process dies, and every other tenant
 * goes down with it. 1 MiB is far above any real dashboard document.
 */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Read the whole body, refusing one that is too large.
 *
 * The count is of bytes actually received, not of `Content-Length`: that
 * header is supplied by the caller, absent entirely under chunked transfer
 * encoding, and trusting it is how a limit gets bypassed.
 */
function readBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<Buffer | null> {
  const method = (request.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    request.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        // Pause rather than destroy. Stopping the read is the point — TCP
        // backpressure stalls the sender and nothing more is buffered — but
        // destroying the socket here would take the 413 down with it, and the
        // caller would see a dropped connection instead of the reason.
        request.pause();
        chunks.length = 0;
        reject(
          DashboardServerError.payloadTooLarge(
            `Request body exceeds the ${maxBytes} byte limit`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
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

export interface NodeListenerOptions {
  /** Called for anything the handler could not turn into a response itself. */
  onError?: (error: unknown) => void;
  /** Largest body to buffer, in bytes. Defaults to `DEFAULT_MAX_BODY_BYTES`. */
  maxBodyBytes?: number;
}

/**
 * Wrap a fetch-style handler as a Node request listener.
 *
 * A handler that throws still has to produce a response: an unhandled
 * rejection here would hang the socket rather than fail the request, which is
 * far worse to diagnose than a 500.
 *
 * A `DashboardServerError` raised by this adapter — a refused body size is the
 * only one today — is serialized through the same envelope the API uses, so
 * the whole port answers in one shape. Anything else is still reduced to a
 * generic 500 with its message dropped.
 */
export function toNodeListener(
  handler: DashboardHandler,
  options: NodeListenerOptions = {},
): (incoming: IncomingMessage, outgoing: ServerResponse) => void {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  return (incoming, outgoing) => {
    void (async () => {
      try {
        const body = await readBody(incoming, maxBodyBytes);
        const response = await handler(toRequest(incoming, body));
        await writeResponse(response, outgoing);
      } catch (error) {
        options.onError?.(error);
        const envelope = toErrorEnvelope(error);
        // A body we stopped reading is still arriving, so this connection
        // cannot carry another request. Saying so lets Node close it once the
        // response is flushed, instead of us racing the write with a destroy.
        const unread = !incoming.readableEnded;
        if (!outgoing.headersSent) {
          outgoing.writeHead(envelope.status, {
            "content-type": "application/json; charset=utf-8",
            // Same no-store policy as every other response on this port; an
            // error body is still tenant-shaped information.
            "cache-control": "no-store",
            ...(unread ? { connection: "close" } : {}),
          });
        }
        outgoing.end(JSON.stringify(envelope));
      }
    })();
  };
}

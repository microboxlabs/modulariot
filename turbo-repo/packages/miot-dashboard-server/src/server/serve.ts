/**
 * The standalone server.
 *
 * Layer 5 of the package: a listener, health probes and lifecycle around the
 * same handler an existing backend would mount. It adds no behaviour of its
 * own to the API, which is the property that keeps the two shapes from
 * drifting apart.
 */

import { createServer, type Server } from "node:http";
import { createAccessControl } from "../access/access-control";
import { createDashboardHandler } from "../http/handler";
import type { AuditSink } from "../seams/audit";
import type { IdentityResolver, ScopeAuthority } from "../seams/identity";
import type { ServerDashboardStore } from "../seams/store";
import { createDocsHandler, DOCS_PATH, SPEC_PATH } from "./docs";
import { toNodeListener } from "./node-adapter";

export interface ServeOptions {
  identity: IdentityResolver<Request>;
  scopes: ScopeAuthority;
  store: ServerDashboardStore;
  audit?: AuditSink;
  basePath?: string;
  port: number;
  host: string;
  /**
   * Serve the contract at /openapi.yaml and render it at /docs. On by
   * default: the document describes a public interface, not a secret, and a
   * server nobody can read the contract of is harder to integrate against
   * than it is safe. Turn it off where the surface itself is sensitive.
   */
  docs?: boolean;
  /** Structured log line sink. Defaults to stdout as JSON. */
  log?: (line: Record<string, unknown>) => void;
}

export interface RunningServer {
  server: Server;
  port: number;
  url: string;
  close(): Promise<void>;
}

const defaultLog = (line: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify(line)}\n`);
};

/**
 * Health and readiness are answered here rather than in the handler, because
 * they describe the process, not the API. A host mounting the library has its
 * own probes and must not inherit ours.
 */
function probeResponse(pathname: string): Response | null {
  if (pathname === "/health" || pathname === "/livez") {
    return Response.json({ status: "ok" });
  }
  if (pathname === "/readyz") {
    return Response.json({ status: "ready" });
  }
  return null;
}

export function createRequestHandler(options: ServeOptions) {
  const accessOptions = {
    identity: options.identity,
    scopes: options.scopes,
    store: options.store,
    ...(options.audit ? { audit: options.audit } : {}),
  };
  // Constructed once so the handler and any future in-process caller share one
  // access control instance rather than two with divergent configuration.
  void createAccessControl<Request>(accessOptions);

  const api = createDashboardHandler({
    ...accessOptions,
    ...(options.basePath ? { basePath: options.basePath } : {}),
  });

  const docs =
    options.docs === false
      ? null
      : createDocsHandler({
          ...(options.basePath ? { basePath: options.basePath } : {}),
        });

  const handle = async function handle(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const probe = probeResponse(pathname);
    if (probe !== null) return probe;
    // Before the API, and never under its base path, so documentation can
    // never shadow a route or be shadowed by one.
    const documented = docs?.(request) ?? null;
    if (documented !== null) return documented;
    return api(request);
  };
  return Object.assign(handle, { docs });
}

export function serve(options: ServeOptions): Promise<RunningServer> {
  const log = options.log ?? defaultLog;
  const handler = createRequestHandler(options);
  const server = createServer(
    toNodeListener(handler, (error) => {
      log({
        level: "error",
        msg: "unhandled request failure",
        error: error instanceof Error ? error.message : String(error),
      });
    }),
  );

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      const port =
        typeof address === "object" && address !== null
          ? address.port
          : options.port;
      const url = `http://${options.host}:${port}`;
      log({
        level: "info",
        msg: "listening",
        url,
        basePath: options.basePath ?? "",
        // Said out loud on startup rather than discovered as a broken page:
        // whether the contract is being served, and whether there is anything
        // installed to render it with.
        ...(handler.docs
          ? {
              spec: `${url}${SPEC_PATH}`,
              docs: handler.docs.rendered
                ? `${url}${DOCS_PATH}`
                : "swagger-ui-dist is not installed; /docs explains how to add it",
            }
          : { docs: false }),
      });
      resolve({
        server,
        port,
        url,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}

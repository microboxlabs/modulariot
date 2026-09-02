/**
 * The contract, served and rendered.
 *
 * `GET /openapi.yaml` returns `contract/openapi.yaml` verbatim, and `GET /docs`
 * renders it with Swagger UI. Verbatim matters: the document a reader explores
 * in the browser is byte-for-byte the one an integrator generates a client
 * from, so the two cannot disagree. Nothing here re-describes the API in
 * TypeScript, which would have created a second definition to keep in step.
 *
 * These routes sit beside the health probes rather than inside the handler,
 * for the same reason the probes do: they describe the deployable, not the
 * API. A host that mounts the library already has its own documentation
 * surface and must not inherit ours.
 *
 * Swagger UI's assets are an **optional** dependency, resolved from
 * `node_modules` at startup and never fetched from a CDN. A dashboard server
 * inside a cluster with no egress has to render its own documentation, and a
 * page that quietly reaches out to a third party for 1.5 MB of JavaScript is
 * not something to hide in a docs route. When the assets are absent the spec
 * is still served and `/docs` says what to install.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DOCS_PATH = "/docs";
export const SPEC_PATH = "/openapi.yaml";

/**
 * The Swagger UI files this server will serve, and nothing else.
 *
 * An allow-list rather than a directory served wholesale: the request path
 * never becomes part of a filesystem path, so traversal is not something to
 * defend against, it is something that cannot be expressed. It also keeps the
 * source maps — 5 MB of them, and a readable copy of Swagger UI's sources —
 * off the wire.
 *
 * `swagger-ui-bundle.js` alone is enough for `BaseLayout`. The standalone
 * preset would add a topbar whose only control loads an arbitrary spec URL,
 * which is not something this server should offer.
 *
 * A `Map` rather than an object literal, because the request path is the key:
 * an object inherits `constructor`, `toString` and `__proto__`, so `name in
 * ASSETS` would answer true for names nobody put on the list.
 */
const ASSETS: ReadonlyMap<string, string> = new Map([
  ["swagger-ui.css", "text/css; charset=utf-8"],
  ["swagger-ui-bundle.js", "text/javascript; charset=utf-8"],
  ["favicon-32x32.png", "image/png"],
  ["favicon-16x16.png", "image/png"],
]);

export interface DocsOptions {
  /**
   * Prefix the API is mounted under, e.g. "/api/dashboard". The spec's paths
   * are written from the root, so "Try it out" prefixes them with this.
   */
  basePath?: string;
  /**
   * Path to the OpenAPI document. Found next to the package when omitted; set
   * it to serve a merged contract without rebuilding.
   */
  specPath?: string;
  /**
   * Directory holding the Swagger UI assets. Resolved from the optional
   * `swagger-ui-dist` dependency when omitted; `null` forces the
   * assets-missing page, which is how the fallback is tested.
   */
  assetsDir?: string | null;
}

export interface DocsHandler {
  /** Null when the path is not one of ours, so the caller falls through. */
  (request: Request): Response | null;
  /** Whether Swagger UI's assets were found. False means /docs explains itself. */
  readonly rendered: boolean;
}

/**
 * Locate `contract/openapi.yaml`.
 *
 * Walking up rather than resolving a fixed relative path, because the layout
 * differs between running from source (`src/server/docs.ts`, two levels down)
 * and running a build (`dist/server.js`, one). A fixed `../..` would work in
 * exactly one of the two and fail confusingly in the other.
 */
export function resolveSpecPath(
  from: string = fileURLToPath(import.meta.url),
): string | null {
  let directory = dirname(from);
  for (let depth = 0; depth < 5; depth++) {
    const candidate = join(directory, "contract", "openapi.yaml");
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return null;
}

/** The `swagger-ui-dist` directory, or null when it is not installed. */
export function resolveAssetsDir(): string | null {
  try {
    const require = createRequire(import.meta.url);
    return dirname(require.resolve("swagger-ui-dist/package.json"));
  } catch {
    return null;
  }
}

export function createDocsHandler(options: DocsOptions = {}): DocsHandler {
  const basePath = options.basePath ?? "";
  const specPath = options.specPath ?? resolveSpecPath();
  const assetsDir =
    options.assetsDir === undefined ? resolveAssetsDir() : options.assetsDir;

  // Assets are versioned with the dependency and never change under a running
  // process, so reading each one once is safe. The spec is deliberately not
  // cached: editing the contract and reloading the page is the whole workflow.
  const assetCache = new Map<string, Uint8Array>();

  function readAsset(name: string): Uint8Array | null {
    if (assetsDir === null || !ASSETS.has(name)) return null;
    const cached = assetCache.get(name);
    if (cached) return cached;
    try {
      const bytes = new Uint8Array(readFileSync(join(assetsDir, name)));
      assetCache.set(name, bytes);
      return bytes;
    } catch {
      return null;
    }
  }

  function spec(): Response {
    if (specPath === null) {
      return problem(
        500,
        "The OpenAPI document could not be found next to the installed package.",
      );
    }
    try {
      return new Response(readFileSync(specPath, "utf8"), {
        status: 200,
        headers: {
          // RFC 9512. Swagger UI parses YAML directly, so there is no
          // conversion step to go wrong between the file and the page.
          "content-type": "application/yaml; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return problem(500, "The OpenAPI document could not be read.");
    }
  }

  function handle(request: Request): Response | null {
    const pathname = pathnameOf(request.url);
    if (pathname !== SPEC_PATH && !isDocsPath(pathname)) return null;

    // GET and HEAD only; the docs surface is read-only by construction.
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return problem(405, "The documentation endpoints are read-only.");
    }

    if (pathname === SPEC_PATH) return spec();
    if (pathname === DOCS_PATH || pathname === `${DOCS_PATH}/`) {
      return html(
        assetsDir === null ? missingAssetsPage(SPEC_PATH) : page(basePath),
      );
    }

    const name = pathname.slice(DOCS_PATH.length + 1);
    const contentType = ASSETS.get(name);
    const bytes = contentType === undefined ? null : readAsset(name);
    if (bytes === null || contentType === undefined) {
      return problem(404, "No such documentation asset.");
    }
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": contentType,
        "x-content-type-options": "nosniff",
      },
    });
  }

  return Object.defineProperty(handle, "rendered", {
    value: assetsDir !== null,
    enumerable: true,
  }) as DocsHandler;
}

// ------------------------------------------------------------- helpers ----

function isDocsPath(pathname: string): boolean {
  return pathname === DOCS_PATH || pathname.startsWith(`${DOCS_PATH}/`);
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? "/";
  }
}

function html(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

/** The same envelope the API uses, so one shape covers the whole port. */
function problem(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message, status, code: codeFor(status) }),
    {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

function codeFor(status: number): string {
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

/**
 * Embed a value in a `<script>`.
 *
 * `JSON.stringify` alone is not enough: a `</script>` inside the value would
 * end the element early, and the browser would parse the rest as markup. The
 * value here comes from configuration rather than from a request, but a
 * server's own base path is not a good place to rely on that staying true.
 */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * What "Try it out" does to a request before sending it.
 *
 * The spec's paths are written from the root, so when the API is mounted under
 * a prefix every request from this page has to have it added back, or the page
 * 404s while curl against the same path works.
 *
 * Exported as source rather than written inline in the page so that the tests
 * can run this exact function rather than a hand-copied restatement of it. The
 * first version of it rewrote *every* same-origin request, including Swagger
 * UI's own fetch of the spec — so under a base path the page failed to load at
 * all, and nothing in the suite noticed, because nothing in the suite could
 * execute it.
 */
export const REQUEST_INTERCEPTOR_SOURCE = `function (req, basePath, origin) {
  if (!basePath) return req;
  var url = new URL(req.url, origin);
  if (url.origin !== origin) return req;
  // The documentation surface is served at the root whatever the API's prefix
  // is. These are the page's own fetches, not calls to the API.
  if (url.pathname === ${JSON.stringify(SPEC_PATH)} ||
      url.pathname === ${JSON.stringify(DOCS_PATH)} ||
      url.pathname.indexOf(${JSON.stringify(`${DOCS_PATH}/`)}) === 0) {
    return req;
  }
  if (url.pathname.indexOf(basePath + "/") !== 0) {
    url.pathname = basePath + url.pathname;
    req.url = url.toString();
  }
  return req;
}`;

function page(basePath: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>MIOT Dashboard API</title>
<link rel="icon" type="image/png" sizes="32x32" href="${DOCS_PATH}/favicon-32x32.png">
<link rel="stylesheet" href="${DOCS_PATH}/swagger-ui.css">
<style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="${DOCS_PATH}/swagger-ui-bundle.js"></script>
<script>
  var BASE_PATH = ${embed(basePath)};
  window.ui = SwaggerUIBundle({
    url: ${embed(SPEC_PATH)},
    dom_id: "#swagger-ui",
    deepLinking: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    defaultModelsExpandDepth: 1,
    requestInterceptor: function (req) {
      return (${REQUEST_INTERCEPTOR_SOURCE})(
        req,
        BASE_PATH,
        window.location.origin,
      );
    },
  });
</script>
</body>
</html>
`;
}

/**
 * Shown when `swagger-ui-dist` is not installed.
 *
 * A 200 rather than an error: the endpoint is working and the page it returns
 * is the useful one for a human who wanted the docs. The spec — the part that
 * actually matters — is served either way.
 */
function missingAssetsPage(specPath: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>MIOT Dashboard API</title>
<style>
  body { margin: 0; padding: 3rem 1.5rem; background: #fafafa; color: #1b1b1b;
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 42rem; margin: 0 auto; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: #fff; border: 1px solid #e2e2e2; border-radius: 6px;
        padding: 0.9rem 1.1rem; overflow-x: auto; }
</style>
</head>
<body>
<main>
<h1>MIOT Dashboard API</h1>
<p>The contract is being served, but Swagger UI is not installed, so there is
nothing to render it with. These assets are an optional dependency: this server
never loads them from a CDN, so that it works in a cluster with no egress and
never reports a page view to a third party.</p>
<pre>npm install swagger-ui-dist</pre>
<p>Restart the server afterwards. In the meantime the document itself is at
<a href="${specPath}"><code>${specPath}</code></a>, which is what an OpenAPI
client generator wants anyway.</p>
</main>
</body>
</html>
`;
}

/**
 * The documentation routes, and — more importantly — whether the document
 * they serve still describes the server.
 *
 * The drift check at the bottom is the reason this file matters. The contract
 * spent P1 describing one of the seven operations the handler answers, which
 * nothing caught because nothing compared the two. Rendering that document in
 * a browser would have turned a stale file into a confidently wrong API
 * reference. Now the spec and the router have to agree in both directions or
 * the suite fails.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDocsHandler,
  resolveAssetsDir,
  resolveSpecPath,
  DOCS_PATH,
  REQUEST_INTERCEPTOR_SOURCE,
  SPEC_PATH,
} from "./docs";
import { serve, type RunningServer } from "./serve";
import type { RouteName } from "../http/routes";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryStore,
} from "../testing";

const get = (path: string, init?: RequestInit) =>
  new Request(`http://test.local${path}`, init);

/** This file is at <root>/src/server/, so the package root is two up. */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the contract endpoint", () => {
  it("serves the file on disk byte for byte", async () => {
    const specPath = resolveSpecPath();
    expect(specPath).not.toBeNull();

    const response = createDocsHandler()(get(SPEC_PATH));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/yaml");
    expect(response?.headers.get("x-content-type-options")).toBe("nosniff");
    // Not "contains the same operations" — identical. A reader exploring the
    // page and an integrator generating a client must be looking at one
    // document, not two renderings of one.
    await expect(response?.text()).resolves.toBe(
      readFileSync(specPath as string, "utf8"),
    );
  });

  it("finds the document from source and from a build", () => {
    // The two layouts the walk-up exists for: src/server/docs.ts is two levels
    // below the package root, dist/server.js is one.
    expect(
      resolveSpecPath(join(PACKAGE_ROOT, "src", "server", "docs.ts")),
    ).toBe(join(PACKAGE_ROOT, "contract", "openapi.yaml"));
    expect(resolveSpecPath(join(PACKAGE_ROOT, "dist", "server.js"))).toBe(
      join(PACKAGE_ROOT, "contract", "openapi.yaml"),
    );
  });

  it("stops at the package root rather than adopting a parent's contract", () => {
    // Built rather than pointed at a real sibling: no parent of this package
    // happens to hold a contract today, so a test against the real tree would
    // pass whether or not the boundary exists. Here the decoy is real.
    //
    //   <tmp>/contract/openapi.yaml   ← another project's document
    //   <tmp>/pkg/package.json        ← our package root, no contract
    //   <tmp>/pkg/dist/server.js      ← where the search starts
    //
    // Serving that decoy would be a documented API quietly describing
    // something else, which is worse than serving no documentation at all.
    const root = mkdtempSync(join(tmpdir(), "miot-docs-"));
    try {
      mkdirSync(join(root, "contract"), { recursive: true });
      writeFileSync(join(root, "contract", "openapi.yaml"), "openapi: 3.1.0\n");
      mkdirSync(join(root, "pkg", "dist"), { recursive: true });
      writeFileSync(join(root, "pkg", "package.json"), "{}\n");

      const start = join(root, "pkg", "dist", "server.js");
      expect(resolveSpecPath(start)).toBeNull();

      // Positive control: the same search finds the package's own contract.
      mkdirSync(join(root, "pkg", "contract"), { recursive: true });
      writeFileSync(
        join(root, "pkg", "contract", "openapi.yaml"),
        "openapi: 3.1.0\n",
      );
      expect(resolveSpecPath(start)).toBe(
        join(root, "pkg", "contract", "openapi.yaml"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports a missing document rather than serving an empty one", async () => {
    const response = createDocsHandler({
      specPath: "/nonexistent/openapi.yaml",
    })(get(SPEC_PATH));
    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
    });
  });
});

describe("the docs page", () => {
  it("renders Swagger UI against our own assets, never a CDN", async () => {
    const response = createDocsHandler()(get(DOCS_PATH));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/html");

    const body = (await response?.text()) ?? "";
    expect(body).toContain(`${DOCS_PATH}/swagger-ui-bundle.js`);
    expect(body).toContain(`${DOCS_PATH}/swagger-ui.css`);
    expect(body).toContain(SPEC_PATH);
    // A page in a cluster with no egress has to render. Any absolute URL here
    // is a request that would silently fail there — and a page view reported
    // to a third party everywhere else.
    expect(body).not.toMatch(/https?:\/\//);
  });

  it("answers /docs/ the same as /docs", async () => {
    const handler = createDocsHandler();
    const withSlash = await handler(get(`${DOCS_PATH}/`))?.text();
    const without = await handler(get(DOCS_PATH))?.text();
    expect(withSlash).toBe(without);
  });

  it("explains itself when swagger-ui-dist is not installed", async () => {
    const handler = createDocsHandler({ assetsDir: null });
    expect(handler.rendered).toBe(false);

    const response = handler(get(DOCS_PATH));
    // 200: the endpoint works, and the page it returns is the useful one.
    expect(response?.status).toBe(200);
    const body = (await response?.text()) ?? "";
    expect(body).toContain("npm install swagger-ui-dist");
    expect(body).toContain(SPEC_PATH);

    // The part that actually matters is served either way.
    expect(handler(get(SPEC_PATH))?.status).toBe(200);
  });

  it("carries the base path into the page", async () => {
    const body =
      (await createDocsHandler({ basePath: "/api/dashboard" })(
        get(DOCS_PATH),
      )?.text()) ?? "";
    expect(body).toContain('"/api/dashboard"');
  });

  it("cannot be made to end its own script element", async () => {
    const body =
      (await createDocsHandler({ basePath: "/x</script><script>alert(1)" })(
        get(DOCS_PATH),
      )?.text()) ?? "";
    expect(body).not.toContain("</script><script>alert(1)");
    expect(body).toContain("\\u003c/script>");
  });
});

/**
 * The rewriter the page runs, run here rather than restated.
 *
 * `new Function` over the exported source, so these cases exercise the exact
 * text the browser executes. The first version of this interceptor rewrote
 * every same-origin request, which meant that under a base path Swagger UI's
 * own fetch of the spec was redirected into the API and the page rendered
 * "Failed to load API definition" — while every test here passed, because the
 * tests only ever looked at the page as a string.
 */
describe('the "Try it out" rewriter', () => {
  const ORIGIN = "http://server.test";
  const intercept = new Function(
    `return (${REQUEST_INTERCEPTOR_SOURCE});`,
  )() as (
    req: { url: string },
    basePath: string,
    origin: string,
  ) => { url: string };

  const rewrite = (url: string, basePath = "/api/dashboard") =>
    intercept({ url }, basePath, ORIGIN).url;

  it("prefixes an API call", () => {
    expect(rewrite(`${ORIGIN}/scopes/ops/dashboards`)).toBe(
      `${ORIGIN}/api/dashboard/scopes/ops/dashboards`,
    );
  });

  it("leaves the spec alone, which is how the page loads at all", () => {
    expect(rewrite(`${ORIGIN}${SPEC_PATH}`)).toBe(`${ORIGIN}${SPEC_PATH}`);
  });

  it.each([DOCS_PATH, `${DOCS_PATH}/swagger-ui-bundle.js`])(
    "leaves %s alone",
    (path) => {
      expect(rewrite(`${ORIGIN}${path}`)).toBe(`${ORIGIN}${path}`);
    },
  );

  it("does nothing at all without a base path", () => {
    expect(rewrite(`${ORIGIN}/scopes/ops/dashboards`, "")).toBe(
      `${ORIGIN}/scopes/ops/dashboards`,
    );
  });

  it("does not prefix twice", () => {
    const once = `${ORIGIN}/api/dashboard/scopes/ops/dashboards`;
    expect(rewrite(once)).toBe(once);
  });

  it("leaves another origin alone", () => {
    expect(rewrite("http://elsewhere.test/scopes/ops/dashboards")).toBe(
      "http://elsewhere.test/scopes/ops/dashboards",
    );
  });
});

describe("asset serving", () => {
  const installed = resolveAssetsDir() !== null;

  it.runIf(installed)("serves an allow-listed asset", async () => {
    const response = createDocsHandler()(
      get(`${DOCS_PATH}/swagger-ui-bundle.js`),
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/javascript");
    expect(response?.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await response?.arrayBuffer())?.byteLength).toBeGreaterThan(1000);
  });

  it.each([
    "swagger-ui-bundle.js.map",
    "swagger-ui-standalone-preset.js",
    "index.js",
    "package.json",
    "LICENSE",
  ])("refuses %s, which is not on the allow-list", (name) => {
    expect(createDocsHandler()(get(`${DOCS_PATH}/${name}`))?.status).toBe(404);
  });

  it.each([
    // A literal "/docs/../x" is normalised away by URL parsing before it ever
    // reaches us; these are the encoded forms that survive it.
    `${DOCS_PATH}/..%2f..%2fpackage.json`,
    `${DOCS_PATH}/%2e%2e%2fpackage.json`,
    `${DOCS_PATH}/nested/swagger-ui.css`,
    `${DOCS_PATH}//etc/passwd`,
  ])("refuses %s", (path) => {
    expect(createDocsHandler()(get(path))?.status).toBe(404);
  });

  it.each(["constructor", "toString", "__proto__", "valueOf"])(
    "refuses %s, which an object-literal allow-list would have answered for",
    (name) => {
      expect(createDocsHandler()(get(`${DOCS_PATH}/${name}`))?.status).toBe(
        404,
      );
    },
  );

  it("serves nothing at all when the assets are absent", () => {
    const handler = createDocsHandler({ assetsDir: null });
    expect(handler(get(`${DOCS_PATH}/swagger-ui-bundle.js`))?.status).toBe(404);
  });
});

describe("routing", () => {
  it("declines paths that are not its own, so the API still sees them", () => {
    const handler = createDocsHandler();
    expect(handler(get("/scopes/ops/dashboards"))).toBeNull();
    expect(handler(get("/health"))).toBeNull();
    expect(handler(get("/openapi.json"))).toBeNull();
    expect(handler(get("/docsomething"))).toBeNull();
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])(
    "refuses %s: the docs surface is read-only",
    (method) => {
      const response = createDocsHandler()(get(SPEC_PATH, { method }));
      expect(response?.status).toBe(405);
    },
  );
});

describe("served by the standalone server", () => {
  let running: RunningServer;

  beforeAll(async () => {
    running = await serve({
      identity: createInsecureHeaderIdentityResolver(),
      scopes: createMemoryScopeAuthority({}),
      store: createMemoryStore(),
      port: 0,
      host: "127.0.0.1",
      log: () => {},
    });
  });

  afterAll(async () => {
    await running.close();
  });

  it("reaches the contract over a real socket", async () => {
    const response = await fetch(`${running.url}${SPEC_PATH}`);
    expect(response.status).toBe(200);
    expect(parseYaml(await response.text()).openapi).toBe("3.1.0");
  });

  it("reaches the page over a real socket", async () => {
    const response = await fetch(`${running.url}${DOCS_PATH}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("still answers the probes and the API", async () => {
    expect((await fetch(`${running.url}/health`)).status).toBe(200);
    // Unauthenticated, so 401 — but reached the API rather than the docs.
    expect((await fetch(`${running.url}/scopes/ops/dashboards`)).status).toBe(
      401,
    );
  });

  it("serves neither when docs are turned off", async () => {
    const off = await serve({
      identity: createInsecureHeaderIdentityResolver(),
      scopes: createMemoryScopeAuthority({}),
      store: createMemoryStore(),
      port: 0,
      host: "127.0.0.1",
      docs: false,
      log: () => {},
    });
    try {
      // 404 from the API handler's own envelope: the path is simply not served.
      expect((await fetch(`${off.url}${SPEC_PATH}`)).status).toBe(404);
      expect((await fetch(`${off.url}${DOCS_PATH}`)).status).toBe(404);
    } finally {
      await off.close();
    }
  });
});

/**
 * Does the document still describe the server?
 *
 * Both directions, because each catches a different failure. A path in the
 * spec that the router does not serve is a lie told to an integrator. A route
 * the router serves that the spec omits is how the contract quietly stopped
 * covering six of seven operations.
 *
 * Nothing here reads the router's internals: every combination is probed with
 * an unauthenticated request, and the handler answers 404 for a path or method
 * it does not serve and 401 for one it does. That the two are distinguishable
 * is itself a property worth leaning on.
 */
describe("the spec against the router", () => {
  const METHODS = ["GET", "PUT", "POST", "PATCH", "DELETE"] as const;
  const EXAMPLE = { scopeId: "ops", slug: "fleet" };

  /**
   * Where each of the router's routes lives, as an exhaustive
   * `Record<RouteName, …>`. Exhaustive on purpose: adding a route to
   * `matchRoute` fails to compile here until someone names its path, and the
   * two checks below then hold it to the contract. Comparing the spec only
   * against the paths the spec already lists would let a whole new endpoint
   * ship undocumented.
   */
  const ROUTE_PATHS: Readonly<Record<RouteName, string>> = {
    dashboards: "/scopes/{scopeId}/dashboards",
    dashboard: "/scopes/{scopeId}/dashboards/{slug}",
    capabilities: "/scopes/{scopeId}/dashboards/{slug}/capabilities",
    permissions: "/scopes/{scopeId}/dashboards/{slug}/permissions",
  };

  const concrete = (template: string) =>
    template
      .replace("{scopeId}", EXAMPLE.scopeId)
      .replace("{slug}", EXAMPLE.slug);

  const spec = parseYaml(readFileSync(resolveSpecPath() as string, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const documented = new Set(
    Object.entries(spec.paths).flatMap(([template, item]) =>
      Object.keys(item)
        .filter((key) =>
          (METHODS as readonly string[]).includes(key.toUpperCase()),
        )
        .map((method) => `${method.toUpperCase()} ${concrete(template)}`),
    ),
  );

  const candidates = [
    ...new Set([...Object.keys(spec.paths), ...Object.values(ROUTE_PATHS)]),
  ].map(concrete);

  let running: RunningServer;
  /** 404 is how the handler answers a path or method it does not serve. */
  const served = async (path: string, method: string) =>
    (await fetch(`${running.url}${path}`, { method })).status !== 404;

  beforeAll(async () => {
    running = await serve({
      identity: createInsecureHeaderIdentityResolver(),
      scopes: createMemoryScopeAuthority({}),
      store: createMemoryStore(),
      port: 0,
      host: "127.0.0.1",
      log: () => {},
    });
  });

  afterAll(async () => {
    await running.close();
  });

  it("documents something", () => {
    // Guards the two checks below: both pass vacuously against an empty spec.
    expect(documented.size).toBeGreaterThan(0);
  });

  it("documents nothing the router does not serve", async () => {
    const phantom: string[] = [];
    for (const entry of documented) {
      const [method, path] = entry.split(" ") as [string, string];
      if (!(await served(path, method))) phantom.push(entry);
    }
    expect(phantom).toEqual([]);
  });

  it("documents every path and method the router serves", async () => {
    const undocumented: string[] = [];
    for (const path of candidates) {
      for (const method of METHODS) {
        if (!(await served(path, method))) continue;
        if (!documented.has(`${method} ${path}`)) {
          undocumented.push(`${method} ${path}`);
        }
      }
    }
    expect(undocumented).toEqual([]);
  });
});

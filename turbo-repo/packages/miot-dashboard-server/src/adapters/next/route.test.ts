/**
 * The adapter is thin on purpose, so what is worth testing is that a route
 * mounted the way the docstring shows actually answers — including the
 * methods a host would otherwise forget to export.
 */

import { describe, expect, it } from "vitest";
import { createNextRouteHandlers } from "./route";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
  type Memberships,
} from "../../testing";

const MEMBERSHIPS: Memberships = { acme: { ops: { ana: "Coordinator" } } };

const mount = (basePath?: string) =>
  createNextRouteHandlers({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(MEMBERSHIPS),
    scopes: createMemoryScopeAuthority(MEMBERSHIPS),
    store: createMemoryStore({
      seed: [
        {
          ref: { tenantId: "acme", scopeId: "ops", slug: "fleet" },
          record: { config: { version: 2, name: "Fleet" } },
        },
      ],
    }),
    ...(basePath === undefined ? {} : { basePath }),
  });

const url = (path: string) => `https://app.test${path}`;
const asAna = { "x-dev-user": "ana" };

describe("createNextRouteHandlers", () => {
  it("answers every method the API serves", () => {
    const handlers = mount();
    expect(Object.keys(handlers).sort()).toEqual([
      "DELETE",
      "GET",
      "OPTIONS",
      "PUT",
    ]);
  });

  it("reads a dashboard through the GET export", async () => {
    const { GET } = mount();
    const response = await GET(
      new Request(url("/tenants/acme/scopes/ops/dashboards/fleet"), {
        headers: asAna,
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { version: 2, name: "Fleet" },
    });
  });

  it("writes through the PUT export", async () => {
    const { PUT, GET } = mount();
    const saved = await PUT(
      new Request(url("/tenants/acme/scopes/ops/dashboards/fleet"), {
        method: "PUT",
        headers: { ...asAna, "content-type": "application/json" },
        body: JSON.stringify({ version: 2, name: "Renamed" }),
      }),
    );
    expect(saved.status).toBe(200);

    const read = await GET(
      new Request(url("/tenants/acme/scopes/ops/dashboards/fleet"), {
        headers: asAna,
      }),
    );
    await expect(read.json()).resolves.toEqual({
      data: { version: 2, name: "Renamed" },
    });
  });

  it("removes through the DELETE export", async () => {
    const { DELETE, GET } = mount();
    expect(
      (
        await DELETE(
          new Request(url("/tenants/acme/scopes/ops/dashboards/fleet"), {
            method: "DELETE",
            headers: asAna,
          }),
        )
      ).status,
    ).toBe(204);

    const read = await GET(
      new Request(url("/tenants/acme/scopes/ops/dashboards/fleet"), {
        headers: asAna,
      }),
    );
    await expect(read.json()).resolves.toEqual({ data: null });
  });

  it("serves under the prefix the route is mounted at", async () => {
    // Next hands the handler the whole pathname, so a mount under
    // app/api/dashboards only works if the prefix is stripped first.
    const { GET } = mount("/api/dashboards");
    const response = await GET(
      new Request(url("/api/dashboards/tenants/acme/scopes/ops/dashboards"), {
        headers: asAna,
      }),
    );
    expect(response.status).toBe(200);
  });

  it("still refuses a caller with no standing", async () => {
    // The adapter adds no authority of its own; it is the same access control
    // as every other entry.
    const { GET } = mount();
    const response = await GET(
      new Request(url("/tenants/globex/scopes/ops/dashboards"), {
        headers: asAna,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("imports nothing from next, in any import form", async () => {
    // The guard *permits* `next` under adapters/next/, which is the whole
    // reason this is checked here instead. Every source file in the
    // directory, and every spelling — `from "next"`, `import("next")`,
    // `require("next")`, `require.resolve("next")`, `next/server` — because a
    // single-form check would pass while the peer dependency came back.
    const { readdir, readFile } = await import("node:fs/promises");
    const here = new URL(".", import.meta.url);
    const files = (await readdir(here)).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(files).toContain("route.ts");

    // The same shape the import guard scans with: every module specifier,
    // whatever keyword introduced it.
    const specifier =
      /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*(?:\.resolve\s*)?\(\s*)["']([^"']+)["']/g;

    for (const name of files) {
      const source = await readFile(new URL(name, here), "utf8");
      const imported = [...source.matchAll(specifier)].map((m) => m[1]);
      const fromNext = imported.filter(
        (id) => id === "next" || id?.startsWith("next/"),
      );
      expect(fromNext, `${name} imports from next`).toEqual([]);
    }
  });
});

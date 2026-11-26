import { describe, expect, it, vi } from "vitest";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryStarStore,
  createMemoryRecentStore,
  createMemoryStore,
  createMemoryTenantAuthority,
} from "../testing";
import { sampleConfig } from "../test/fixtures";

const BASE = "http://localhost/tenants/acme/scopes/ops";

function setup(withStars = true) {
  const memberships = {
    acme: {
      ops: {
        lector: "Consumer" as const,
        editor: "Editor" as const,
        admin: "Coordinator" as const,
      },
    },
  };
  const ref = { tenantId: "acme", scopeId: "ops" };
  const store = createMemoryStore({
    seed: [
      { slug: "fleet", tags: ["Ops", " ops ", "", "Daily"] },
      { slug: "sales", tags: undefined },
    ].map(({ slug, tags }) => ({
      ref: { ...ref, slug },
      record: {
        config: { ...sampleConfig({ name: slug }), ...(tags ? { tags } : {}) },
      },
    })),
  });
  const options = {
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    ...(withStars ? { stars: createMemoryStarStore({ store }) } : {}),
  };
  const handler = createDashboardHandler(options);
  const call = (user: string, method: string, path: string) =>
    handler(
      new Request(`${BASE}${path}`, {
        method,
        headers: { "x-dev-user": user },
      }),
    );
  const starsOf = async (user: string) => {
    const response = await call(user, "GET", "/stars");
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: string[] }).data;
  };
  return { call, starsOf, options, store };
}

describe("star routes", () => {
  it.each(["star", "open"])(
    "rejects a personal %s without scope transactions",
    async (action) => {
      const { options, store } = setup();
      const stars = createMemoryStarStore();
      const recents = createMemoryRecentStore();
      const writeStar = vi.spyOn(stars, "star");
      const writeOpen = vi.spyOn(recents, "record");
      const handler = createDashboardHandler({
        ...options,
        store: { ...store, scopeTransaction: undefined },
        stars,
        recents,
      });
      const response = await handler(
        new Request(`${BASE}/dashboards/fleet/${action}`, {
          method: "PUT",
          headers: { "x-dev-user": "lector" },
        }),
      );
      expect(response.status).toBe(400);
      expect(writeStar).not.toHaveBeenCalled();
      expect(writeOpen).not.toHaveBeenCalled();
    },
  );

  it("retries personal cleanup after a nontransactional delete failed", async () => {
    const { options, store } = setup();
    const recents = createMemoryRecentStore();
    const scope = { tenantId: "acme", scopeId: "ops" };
    await recents.record(scope, "lector", "fleet");
    const forget = vi
      .fn()
      .mockRejectedValueOnce(new Error("Cleanup failed"))
      .mockImplementation(recents.forget);
    const handler = createDashboardHandler({
      ...options,
      store: { ...store, scopeTransaction: undefined },
      recents: { ...recents, forget },
    });
    const remove = () =>
      handler(
        new Request(`${BASE}/dashboards/fleet`, {
          method: "DELETE",
          headers: { "x-dev-user": "admin" },
        }),
      );
    expect((await remove()).status).toBe(500);
    expect(await store.load({ ...scope, slug: "fleet" })).toBeNull();
    expect((await remove()).status).toBe(404);
    expect(await recents.list(scope, "lector", 10)).toEqual([]);
  });

  it("lets any member star what they can open, privately", async () => {
    const { call, starsOf } = setup();
    expect((await call("lector", "PUT", "/dashboards/fleet/star")).status).toBe(
      204,
    );
    expect((await call("lector", "PUT", "/dashboards/fleet/star")).status).toBe(
      204,
    );
    expect(await starsOf("lector")).toEqual(["fleet"]);
    expect(await starsOf("editor")).toEqual([]);

    expect(
      (await call("lector", "DELETE", "/dashboards/fleet/star")).status,
    ).toBe(204);
    expect(await starsOf("lector")).toEqual([]);
  });

  it("refuses strangers and dashboards that do not exist", async () => {
    const { call } = setup();
    expect(
      (await call("stranger", "PUT", "/dashboards/fleet/star")).status,
    ).toBe(403);
    expect((await call("lector", "PUT", "/dashboards/nope/star")).status).toBe(
      404,
    );
    expect((await call("stranger", "GET", "/stars")).status).toBe(403);
  });

  it("forgets the stars of a deleted dashboard", async () => {
    const { call, starsOf } = setup();
    await call("lector", "PUT", "/dashboards/fleet/star");
    expect((await call("admin", "DELETE", "/dashboards/fleet")).status).toBe(
      204,
    );
    expect(await starsOf("lector")).toEqual([]);
  });

  it("answers 404 when the host keeps no stars", async () => {
    const { call } = setup(false);
    expect((await call("lector", "GET", "/stars")).status).toBe(404);
    expect((await call("lector", "PUT", "/dashboards/fleet/star")).status).toBe(
      404,
    );
  });

  it("lists each dashboard's tags, trimmed and once each", async () => {
    const { call } = setup();
    const response = await call("lector", "GET", "/dashboards");
    expect(((await response.json()) as { data: unknown }).data).toEqual([
      {
        slug: "fleet",
        name: "fleet",
        tags: ["Ops", "ops", "Daily"],
        updatedAt: expect.any(String),
      },
      { slug: "sales", name: "sales", updatedAt: expect.any(String) },
    ]);
  });
});

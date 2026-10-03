import { describe, expect, it, vi } from "vitest";
import { createDashboardHandler } from "./handler";
import { createAllowedGroupsPolicy } from "../access/allowed-groups";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
  createMemoryStore,
} from "../testing";
import { sampleConfig } from "../test/fixtures";

function setup() {
  const memberships = { acme: { ops: { viewer: "Consumer" as const } } };
  const ref = { tenantId: "acme", scopeId: "ops" };
  const store = createMemoryStore({
    seed: [
      {
        ref: { ...ref, slug: "open" },
        record: { config: sampleConfig({ name: "Open" }) },
      },
      {
        ref: { ...ref, slug: "secret" },
        record: {
          config: {
            ...sampleConfig({ name: "Secret title" }),
            allowedGroups: ["private"],
          },
        },
      },
      {
        ref: { ...ref, slug: "broken" },
        record: { config: { ...sampleConfig(), allowedGroups: 42 } },
      },
    ],
  });
  const resolver = createInsecureHeaderIdentityResolver();
  const resolve = vi.fn(resolver.resolve.bind(resolver));
  const handler = createDashboardHandler({
    identity: { resolve },
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    policy: createAllowedGroupsPolicy(),
  });
  const request = (suffix = "") =>
    handler(
      new Request(
        `http://localhost/tenants/acme/scopes/ops/dashboards${suffix}`,
        { headers: { "x-dev-user": "viewer" } },
      ),
    );
  return { store, request, resolve };
}

describe("dashboard list visibility", () => {
  it("hides forbidden and malformed audiences using one credential resolution", async () => {
    const { request, resolve } = setup();
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ slug: "open", name: "Open" }],
    });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect((await request("/secret")).status).toBe(403);
  });

  it("returns each dashboard's order and lists by it, unordered last", async () => {
    const { store, request } = setup();
    const ref = { tenantId: "acme", scopeId: "ops" };
    await store.save(
      { ...ref, slug: "first" },
      sampleConfig({ name: "Zeta", order: 1 }),
      { updatedBy: "viewer" },
    );
    await store.save(
      { ...ref, slug: "open" },
      sampleConfig({ name: "Open", order: 3 }),
      { updatedBy: "viewer" },
    );
    await store.save({ ...ref, slug: "plain" }, sampleConfig({ name: "Alpha" }), {
      updatedBy: "viewer",
    });
    expect(await (await request()).json()).toEqual({
      data: [
        { slug: "first", name: "Zeta", order: 1 },
        { slug: "open", name: "Open", order: 3 },
        { slug: "plain", name: "Alpha" },
      ],
    });
  });

  it("fails closed on storage errors instead of returning an unfiltered list", async () => {
    const { store, request } = setup();
    vi.spyOn(store, "getPermissions").mockRejectedValue(
      new Error("private backend error"),
    );
    const response = await request();
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("Secret title");
    expect(body).not.toContain("private backend error");
  });

  it("omits a dashboard removed between listing and loading", async () => {
    const { store, request } = setup();
    vi.spyOn(store, "load").mockResolvedValue(null);
    expect(await (await request()).json()).toEqual({ data: [] });
  });
  it("returns the name from the same record that passed the visibility policy", async () => {
    const { store, request } = setup();
    const load = store.load.bind(store);
    vi.spyOn(store, "load").mockImplementation(async (ref) => {
      const record = await load(ref);
      if (ref.slug !== "secret" || !record) return record;
      return { ...record, config: sampleConfig({ name: "Now public" }) };
    });
    const response = await request();
    expect(await response.json()).toEqual({
      data: [
        { slug: "open", name: "Open" },
        { slug: "secret", name: "Now public" },
      ],
    });
  });
});

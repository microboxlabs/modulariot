import { describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryFolderStore,
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
} from "../testing";
import { sampleConfig } from "../test/fixtures";

const BASE = "http://localhost/tenants/acme/scopes/ops";

function setup(withFolders = true) {
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
    seed: ["fleet", "sales"].map((slug) => ({
      ref: { ...ref, slug },
      record: { config: sampleConfig({ name: slug }) },
    })),
  });
  const handler = createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    ...(withFolders ? { folders: createMemoryFolderStore(store) } : {}),
  });
  const call = (user: string, method: string, path: string, body?: unknown) =>
    handler(
      new Request(`${BASE}${path}`, {
        method,
        headers: { "x-dev-user": user, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  const createFolder = async (name: string, parentId?: string) => {
    const response = await call("editor", "POST", "/folders", {
      name,
      ...(parentId ? { parentId } : {}),
    });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { id: string } };
    // New folders start restricted; these tests are about folders anyone
    // in the scope sees.
    await call("editor", "PUT", `/folders/${data.id}/permissions`, {
      assignments: [],
      visibility: "organization",
    });
    return data;
  };
  return { call, store, createFolder };
}

describe("folder routes", () => {
  it("lets every member list folders, and editors create and rename them", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("Ops");
    await createFolder("Daily", ops.id);

    const list = await call("lector", "GET", "/folders");
    expect(list.status).toBe(200);
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(2);

    expect(
      (await call("lector", "POST", "/folders", { name: "X" })).status,
    ).toBe(403);
    const renamed = await call("editor", "PATCH", `/folders/${ops.id}`, {
      name: "Operations",
    });
    expect(await renamed.json()).toEqual({
      data: { id: ops.id, name: "Operations", parentId: null },
    });
  });

  it("answers 409 for a taken name and a folder moved inside itself", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("Ops");
    const daily = await createFolder("Daily", ops.id);
    expect(
      (await call("editor", "POST", "/folders", { name: "ops" })).status,
    ).toBe(409);
    expect(
      (
        await call("editor", "PATCH", `/folders/${ops.id}`, {
          parentId: daily.id,
        })
      ).status,
    ).toBe(409);
  });

  it("refuses bodies it does not understand", async () => {
    const { call } = setup();
    expect(
      (await call("editor", "POST", "/folders", { name: " " })).status,
    ).toBe(400);
    expect(
      (await call("editor", "POST", "/folders", { name: "A", parent: "x" }))
        .status,
    ).toBe(400);
    expect((await call("editor", "PATCH", "/folders/x", {})).status).toBe(400);
  });

  it("files a dashboard and shows its folder in the dashboard list", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("Ops");
    expect(
      (
        await call("lector", "PUT", "/dashboards/fleet/folder", {
          folderId: ops.id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("editor", "PUT", "/dashboards/fleet/folder", {
          folderId: ops.id,
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await call("editor", "PUT", "/dashboards/missing/folder", {
          folderId: null,
        })
      ).status,
    ).toBe(404);

    const list = await call("lector", "GET", "/dashboards");
    const { data } = (await list.json()) as {
      data: { slug: string; folderId?: string }[];
    };
    expect(data.find((d) => d.slug === "fleet")?.folderId).toBe(ops.id);
    expect(data.find((d) => d.slug === "sales")).not.toHaveProperty("folderId");
  });

  it("lets only coordinators delete a folder, taking its dashboards with it", async () => {
    const { call, store, createFolder } = setup();
    const ops = await createFolder("Ops");
    const daily = await createFolder("Daily", ops.id);
    await call("editor", "PUT", "/dashboards/fleet/folder", {
      folderId: daily.id,
    });

    expect((await call("editor", "DELETE", `/folders/${ops.id}`)).status).toBe(
      403,
    );
    expect(
      await store.load({ tenantId: "acme", scopeId: "ops", slug: "fleet" }),
    ).not.toBeNull();

    expect((await call("admin", "DELETE", `/folders/${ops.id}`)).status).toBe(
      204,
    );
    expect(
      await store.load({ tenantId: "acme", scopeId: "ops", slug: "fleet" }),
    ).toBeNull();
    expect(
      await store.load({ tenantId: "acme", scopeId: "ops", slug: "sales" }),
    ).not.toBeNull();
    const list = await call("admin", "GET", "/folders");
    expect(await list.json()).toEqual({ data: [] });
    expect((await call("admin", "DELETE", `/folders/${ops.id}`)).status).toBe(
      404,
    );
  });

  it("answers 404 on every folder route where no folder store is configured", async () => {
    const { call } = setup(false);
    expect((await call("admin", "GET", "/folders")).status).toBe(404);
    expect(
      (await call("admin", "POST", "/folders", { name: "A" })).status,
    ).toBe(404);
    expect(
      (
        await call("admin", "PUT", "/dashboards/fleet/folder", {
          folderId: null,
        })
      ).status,
    ).toBe(404);
  });
});

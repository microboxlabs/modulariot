import { describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryFolderStore,
  createMemoryRecentStore,
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
} from "../testing";
import { sampleConfig } from "../test/fixtures";

const BASE = "http://localhost/tenants/acme/scopes/ops";

function setup(withRecents = true) {
  const memberships = {
    acme: {
      ops: {
        lector: "Consumer" as const,
        admin: "Coordinator" as const,
      },
    },
  };
  const ref = { tenantId: "acme", scopeId: "ops" };
  const store = createMemoryStore({
    seed: ["fleet", "sales", "yard"].map((slug) => ({
      ref: { ...ref, slug },
      record: { config: sampleConfig({ name: slug }) },
    })),
  });
  // A clock that ticks a second per open, so the order is certain.
  let tick = Date.parse("2026-11-23T12:00:00Z");
  const now = () => new Date((tick += 1000));
  const handler = createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    folders: createMemoryFolderStore(),
    ...(withRecents ? { recents: createMemoryRecentStore({ now }) } : {}),
  });
  const call = (user: string, method: string, path: string, body?: unknown) =>
    handler(
      new Request(`${BASE}${path}`, {
        method,
        headers: {
          "x-dev-user": user,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  const recentsOf = async (user: string, query = "") => {
    const response = await call(user, "GET", `/recents${query}`);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as {
      data: { slug: string; openedAt: string }[];
    };
    return data.map((open) => open.slug);
  };
  return { call, recentsOf };
}

describe("recents routes", () => {
  it("lists each member's opens, newest first, each once", async () => {
    const { call, recentsOf } = setup();
    for (const slug of ["fleet", "sales", "fleet"]) {
      expect(
        (await call("lector", "PUT", `/dashboards/${slug}/open`)).status,
      ).toBe(204);
    }
    expect(await recentsOf("lector")).toEqual(["fleet", "sales"]);
    // Private: nobody else sees them.
    expect(await recentsOf("admin")).toEqual([]);
  });

  it("returns the open time, and as many as the limit asks", async () => {
    const { call, recentsOf } = setup();
    for (const slug of ["fleet", "sales", "yard"]) {
      await call("lector", "PUT", `/dashboards/${slug}/open`);
    }
    expect(await recentsOf("lector", "?limit=2")).toEqual(["yard", "sales"]);
    const response = await call("lector", "GET", "/recents?limit=1");
    const { data } = (await response.json()) as {
      data: { slug: string; openedAt: string }[];
    };
    expect(data).toEqual([{ slug: "yard", openedAt: expect.any(String) }]);
    expect((await call("lector", "GET", "/recents?limit=0")).status).toBe(400);
    expect((await call("lector", "GET", "/recents?limit=x")).status).toBe(400);
  });

  it("refuses strangers and dashboards that do not exist", async () => {
    const { call } = setup();
    expect(
      (await call("stranger", "PUT", "/dashboards/fleet/open")).status,
    ).toBe(403);
    expect((await call("lector", "PUT", "/dashboards/nope/open")).status).toBe(
      404,
    );
    expect((await call("stranger", "GET", "/recents")).status).toBe(403);
  });

  it("forgets the opens of a deleted dashboard, alone or in a folder", async () => {
    const { call, recentsOf } = setup();
    await call("lector", "PUT", "/dashboards/fleet/open");
    await call("lector", "PUT", "/dashboards/sales/open");
    expect((await call("admin", "DELETE", "/dashboards/fleet")).status).toBe(
      204,
    );
    expect(await recentsOf("lector")).toEqual(["sales"]);

    const created = await call("admin", "POST", "/folders", {
      name: "Old",
      parentId: null,
    });
    const { data: folder } = (await created.json()) as { data: { id: string } };
    await call("admin", "PUT", "/dashboards/sales/folder", {
      folderId: folder.id,
    });
    expect(
      (await call("admin", "DELETE", `/folders/${folder.id}`)).status,
    ).toBe(204);
    expect(await recentsOf("lector")).toEqual([]);
  });

  it("answers 404 when the host keeps no recents", async () => {
    const { call } = setup(false);
    expect((await call("lector", "GET", "/recents")).status).toBe(404);
    expect((await call("lector", "PUT", "/dashboards/fleet/open")).status).toBe(
      404,
    );
  });
});

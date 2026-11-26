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
import type { DashboardCapabilities } from "../seams/identity";
import type { PermissionAssignment } from "../seams/store";

const BASE = "http://localhost/tenants/acme/scopes/ops";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  role: string;
}

function identityWithCeiling(ceiling: Partial<DashboardCapabilities>) {
  const identities = createInsecureHeaderIdentityResolver();
  return {
    async resolve(request: Request) {
      const principal = await identities.resolve(request);
      return principal === null
        ? null
        : {
            ...principal,
            capabilities: { ...principal.capabilities, ...ceiling },
          };
    },
  };
}

function setup(
  restricted: readonly string[] = [],
  ceiling: Partial<DashboardCapabilities> = {},
  withFolders = true,
) {
  const memberships: {
    acme: { ops: Record<string, "Consumer" | "Editor" | "Coordinator"> };
  } = {
    acme: {
      ops: {
        lector: "Consumer",
        otro: "Consumer",
        editor: "Editor",
        owner: "Coordinator",
      },
    },
  };
  const ref = { tenantId: "acme", scopeId: "ops" };
  const store = createMemoryStore({
    seed: [
      { slug: "fleet", createdBy: "editor" },
      { slug: "sales", createdBy: "lector" },
    ].map(({ slug, createdBy }) => ({
      ref: { ...ref, slug },
      record: {
        config: sampleConfig({
          name: slug,
          ...(restricted.includes(slug) ? { visibility: "restricted" } : {}),
        }),
        createdBy,
      },
    })),
  });
  const handler = createDashboardHandler({
    identity: identityWithCeiling(ceiling),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    ...(withFolders ? { folders: createMemoryFolderStore(store) } : {}),
  });
  const call = (
    user: string,
    method: string,
    path: string,
    body?: unknown,
    groups?: string,
  ) =>
    handler(
      new Request(`${BASE}${path}`, {
        method,
        headers: {
          "x-dev-user": user,
          "content-type": "application/json",
          ...(groups ? { "x-dev-groups": groups } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  const createFolder = async (
    user: string,
    name: string,
    parentId: string | null = null,
  ) => {
    const response = await call(user, "POST", "/folders", { name, parentId });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Folder };
    // New folders start restricted; most tests here want one the whole
    // scope sees. Preserve any explicit creator grant while changing visibility.
    const permissions = await call(
      user,
      "GET",
      `/folders/${data.id}/permissions`,
    );
    expect(permissions.status).toBe(200);
    const { assignments } = (await permissions.json()) as {
      assignments: PermissionAssignment[];
    };
    expect(
      (
        await call(user, "PUT", `/folders/${data.id}/permissions`, {
          assignments,
          visibility: "organization",
        })
      ).status,
    ).toBe(204);
    return data;
  };
  const foldersOf = async (user: string, groups?: string) => {
    const response = await call(user, "GET", "/folders", undefined, groups);
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: Folder[] }).data;
  };
  const slugsOf = async (user: string, groups?: string) => {
    const response = await call(user, "GET", "/dashboards", undefined, groups);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { slug: string }[] };
    return data.map((d) => d.slug).sort();
  };
  /** Keeps a folder to who it names, as `user` (who must manage it). */
  const restrictFolder = async (
    user: string,
    folderId: string,
    assignments: unknown[] = [],
  ) => {
    expect(
      (
        await call(user, "PUT", `/folders/${folderId}/permissions`, {
          assignments,
          visibility: "restricted",
        })
      ).status,
    ).toBe(204);
  };
  return {
    call,
    createFolder,
    foldersOf,
    slugsOf,
    restrictFolder,
    memberships,
    store,
    handler,
  };
}

describe("folder permissions", () => {
  it("answers 404 for missing permissions even for a scope Coordinator", async () => {
    const { call } = setup();
    expect(
      (await call("owner", "GET", "/folders/missing/permissions")).status,
    ).toBe(404);
  });

  it("rejects repeated authorities before replacing permissions", async () => {
    const { call, createFolder } = setup();
    const folder = await createFolder("owner", "Ops");
    expect(
      (
        await call("owner", "PUT", `/folders/${folder.id}/permissions`, {
          assignments: [
            { authorityId: "lector", role: "Consumer" },
            { authorityId: "lector", role: "Coordinator" },
          ],
        })
      ).status,
    ).toBe(400);
  });

  it.each([
    ["POST", "/folders", "canEdit", { name: "Blocked" }],
    ["PATCH", "/folders/:id", "canEdit", { name: "Blocked" }],
    ["DELETE", "/folders/:id", "canDelete", undefined],
    ["GET", "/folders/:id/permissions", "canManagePermissions", undefined],
    [
      "PUT",
      "/folders/:id/permissions",
      "canManagePermissions",
      { assignments: [] },
    ],
  ] as const)(
    "applies the principal's %s %s ceiling",
    async (method, path, capability, body) => {
      const ceiling: Partial<DashboardCapabilities> = {};
      const { call, createFolder } = setup([], ceiling);
      const folder = await createFolder("owner", "Ops");
      ceiling[capability] = false;
      expect(
        (await call("owner", method, path.replace(":id", folder.id), body))
          .status,
      ).toBe(403);
    },
  );

  it("gives each folder the caller's role, scope or folder, the higher", async () => {
    const { call, createFolder, foldersOf } = setup();
    const ops = await createFolder("editor", "Ops");
    expect(
      (
        await call("owner", "PUT", `/folders/${ops.id}/permissions`, {
          assignments: [{ authorityId: "lector", role: "Editor" }],
        })
      ).status,
    ).toBe(204);

    expect(await foldersOf("lector")).toEqual([
      { id: ops.id, name: "Ops", parentId: null, role: "Editor" },
    ]);
    expect((await foldersOf("otro"))[0]?.role).toBe("Consumer");
    expect((await foldersOf("owner"))[0]?.role).toBe("Coordinator");

    // Editor on the folder: creates inside it, but not at the top level.
    const daily = await createFolder("lector", "Daily", ops.id);
    expect(
      (
        await call("lector", "PATCH", `/folders/${daily.id}`, {
          name: "Renamed",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("lector", "GET", `/folders/${daily.id}/permissions`)).status,
    ).toBe(200);
    expect(
      (
        await call("lector", "POST", "/folders", {
          name: "Top",
          parentId: null,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("otro", "POST", "/folders", {
          name: "Nope",
          parentId: ops.id,
        })
      ).status,
    ).toBe(403);
  });

  it("lets only a Coordinator on the folder manage it", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("owner", "Ops");
    const path = `/folders/${ops.id}/permissions`;
    expect((await call("editor", "GET", path)).status).toBe(403);
    expect(
      (
        await call("owner", "PUT", path, {
          assignments: [{ authorityId: "team:7", role: "Coordinator" }],
        })
      ).status,
    ).toBe(204);
    // A team member gets the role through the group.
    const read = await call("lector", "GET", path, undefined, "team:7");
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      assignments: [{ authorityId: "team:7", role: "Coordinator" }],
      visibility: "organization",
    });
    expect(
      (
        await call(
          "lector",
          "DELETE",
          `/folders/${ops.id}`,
          undefined,
          "team:7",
        )
      ).status,
    ).toBe(204);
  });

  it("makes a folder's creator its Coordinator, on that folder only", async () => {
    const { call, createFolder, foldersOf } = setup();
    const mine = await createFolder("editor", "Mine");
    const theirs = await createFolder("owner", "Theirs");
    const roles = Object.fromEntries(
      (await foldersOf("editor")).map((f) => [f.name, f.role]),
    );
    expect(roles).toEqual({ Mine: "Coordinator", Theirs: "Editor" });
    const path = `/folders/${mine.id}/permissions`;
    expect(
      (
        await call("editor", "PUT", path, {
          assignments: [{ authorityId: "lector", role: "Consumer" }],
        })
      ).status,
    ).toBe(204);
    expect(
      (await call("editor", "GET", `/folders/${theirs.id}/permissions`)).status,
    ).toBe(403);
    expect((await call("editor", "DELETE", `/folders/${mine.id}`)).status).toBe(
      204,
    );
  });

  it("drops a creator's control once the organization demotes them", async () => {
    const { call, createFolder, memberships } = setup();
    const mine = await createFolder("editor", "Mine");
    memberships.acme.ops.editor = "Consumer";
    expect(
      (await call("editor", "GET", `/folders/${mine.id}/permissions`)).status,
    ).toBe(403);
  });

  it("refuses a malformed list", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("editor", "Ops");
    expect(
      (
        await call("owner", "PUT", `/folders/${ops.id}/permissions`, {
          assignments: [{ authorityId: "x", role: "Boss" }],
        })
      ).status,
    ).toBe(400);
  });
});

describe("visibility", () => {
  it("requires rights on contents before opening a folder or adding recipients", async () => {
    const { call, createFolder, restrictFolder, slugsOf } = setup();
    const folder = await createFolder("editor", "Mine");
    await call("owner", "PUT", "/dashboards/sales/folder", {
      folderId: folder.id,
    });
    await restrictFolder("editor", folder.id);
    for (const body of [
      { assignments: [], visibility: "organization" },
      {
        assignments: [{ authorityId: "otro", role: "Consumer" }],
        visibility: "restricted",
      },
    ]) {
      expect(
        (await call("editor", "PUT", `/folders/${folder.id}/permissions`, body))
          .status,
      ).toBe(403);
    }
    expect(await slugsOf("otro")).toEqual(["fleet"]);
    expect(
      (
        await call("owner", "PUT", `/folders/${folder.id}/permissions`, {
          assignments: [{ authorityId: "otro", role: "Consumer" }],
          visibility: "restricted",
        })
      ).status,
    ).toBe(204);
    expect(await slugsOf("otro")).toEqual(["fleet", "sales"]);
  });
  it("requires rights on contained dashboards before exposing a folder subtree", async () => {
    const { call, createFolder, restrictFolder, slugsOf } = setup();
    const parent = await createFolder("owner", "Private");
    const child = await createFolder("editor", "Child", parent.id);
    await call("owner", "PUT", "/dashboards/sales/folder", {
      folderId: child.id,
    });
    await restrictFolder("owner", parent.id, [
      { authorityId: "editor", role: "Editor" },
    ]);
    expect(
      (
        await call("editor", "PATCH", `/folders/${child.id}`, {
          parentId: null,
        })
      ).status,
    ).toBe(403);
    expect(await slugsOf("otro")).toEqual(["fleet"]);
    expect(
      (await call("owner", "PATCH", `/folders/${child.id}`, { parentId: null }))
        .status,
    ).toBe(200);
  });
  it("requires permission management to expose a dashboard outside its restricted folder", async () => {
    const { call, createFolder, restrictFolder, slugsOf } = setup();
    const folder = await createFolder("owner", "Private");
    await call("owner", "PUT", "/dashboards/sales/folder", {
      folderId: folder.id,
    });
    await restrictFolder("owner", folder.id, [
      { authorityId: "editor", role: "Editor" },
    ]);
    expect(
      (
        await call("editor", "PUT", "/dashboards/sales/folder", {
          folderId: null,
        })
      ).status,
    ).toBe(403);
    expect(await slugsOf("otro")).toEqual(["fleet"]);
    expect(
      (
        await call("owner", "PUT", "/dashboards/sales/folder", {
          folderId: null,
        })
      ).status,
    ).toBe(204);
  });

  it("requires managing a subtree to move it outside a restricted ancestor", async () => {
    const { call, createFolder, restrictFolder, foldersOf } = setup();
    const parent = await createFolder("owner", "Private");
    const child = await createFolder("owner", "Child", parent.id);
    await restrictFolder("owner", parent.id, [
      { authorityId: "editor", role: "Editor" },
    ]);
    expect(
      (
        await call("editor", "PATCH", `/folders/${child.id}`, {
          parentId: null,
        })
      ).status,
    ).toBe(403);
    expect(await foldersOf("otro")).toEqual([]);
    expect(
      (await call("owner", "PATCH", `/folders/${child.id}`, { parentId: null }))
        .status,
    ).toBe(200);
  });

  it("clears placement when a dashboard is deleted and its slug reused", async () => {
    const { call, createFolder, slugsOf } = setup();
    const folder = await createFolder("owner", "Private");
    await call("owner", "PUT", "/dashboards/sales/folder", {
      folderId: folder.id,
    });
    expect((await call("owner", "DELETE", "/dashboards/sales")).status).toBe(
      204,
    );
    expect(
      (await call("owner", "PUT", "/dashboards/sales", sampleConfig())).status,
    ).toBe(200);
    expect(await slugsOf("otro")).toContain("sales");
  });

  it.each([undefined, '"2"'])(
    "refuses a stale authorization even with If-Match %s",
    async (ifMatch) => {
      const { handler, store } = setup([], {}, false);
      const ref = { tenantId: "acme", scopeId: "ops", slug: "sales" };
      // Pull only when the handler reads the body, after its authorization.
      const body = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            await store.save(ref, sampleConfig({ visibility: "restricted" }), {
              updatedBy: "owner",
            });
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(sampleConfig())),
            );
            controller.close();
          },
        },
        { highWaterMark: 0 },
      );
      const init: RequestInit = {
        method: "PUT",
        duplex: "half",
        headers: {
          "x-dev-user": "editor",
          "content-type": "application/json",
          ...(ifMatch ? { "if-match": ifMatch } : {}),
        },
        body,
      };
      expect(
        (await handler(new Request(`${BASE}/dashboards/sales`, init))).status,
      ).toBe(409);
      expect((await store.load(ref))?.config).toMatchObject({
        visibility: "restricted",
      });
    },
  );

  it("starts a new folder restricted to who its creator names", async () => {
    const { call, foldersOf } = setup();
    const created = await call("editor", "POST", "/folders", { name: "Mine" });
    const { data } = (await created.json()) as { data: Folder };
    expect(
      await (
        await call("editor", "GET", `/folders/${data.id}/permissions`)
      ).json(),
    ).toEqual({ assignments: [], visibility: "restricted" });
    expect(await foldersOf("lector")).toEqual([]);
    expect((await foldersOf("owner")).map((f) => f.name)).toEqual(["Mine"]);
  });

  it("is read and set with a folder's permissions, by who manages it", async () => {
    const { call, createFolder } = setup();
    const ops = await createFolder("owner", "Ops");
    const path = `/folders/${ops.id}/permissions`;
    expect(await (await call("owner", "GET", path)).json()).toEqual({
      assignments: [],
      visibility: "organization",
    });
    expect(
      (
        await call("editor", "PUT", path, {
          assignments: [],
          visibility: "restricted",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("owner", "PUT", path, {
          assignments: [],
          visibility: "secret",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("owner", "PUT", path, {
          assignments: [],
          visibility: "restricted",
        })
      ).status,
    ).toBe(204);
    expect(
      (
        (await (await call("owner", "GET", path)).json()) as {
          visibility: string;
        }
      ).visibility,
    ).toBe("restricted");
    // A client that leaves it out leaves it as it is.
    await call("owner", "PUT", path, { assignments: [] });
    expect(
      (
        (await (await call("owner", "GET", path)).json()) as {
          visibility: string;
        }
      ).visibility,
    ).toBe("restricted");
  });

  it("shows a restricted folder to owners, its creator and who it names", async () => {
    const { createFolder, foldersOf, restrictFolder } = setup();
    const ops = await createFolder("editor", "Ops");
    await createFolder("owner", "Open");
    await restrictFolder("editor", ops.id);
    const names = async (user: string) =>
      (await foldersOf(user)).map((f) => f.name).sort();
    expect(await names("owner")).toEqual(["Open", "Ops"]);
    expect(await names("editor")).toEqual(["Open", "Ops"]);
    expect(await names("lector")).toEqual(["Open"]);
    await restrictFolder("editor", ops.id, [
      { authorityId: "otro", role: "Consumer" },
    ]);
    expect(await names("otro")).toEqual(["Open", "Ops"]);
  });

  it("shows a restricted dashboard to owners, its creator and who it names", async () => {
    const { call, slugsOf } = setup(["fleet"]);
    expect(await slugsOf("owner")).toEqual(["fleet", "sales"]);
    expect(await slugsOf("editor")).toEqual(["fleet", "sales"]);
    expect(await slugsOf("lector")).toEqual(["sales"]);
    expect((await call("otro", "GET", "/dashboards/fleet")).status).toBe(403);
    // Named on it, as one of a team: it shows.
    await call("owner", "PUT", "/dashboards/fleet/permissions", {
      assignments: [{ authorityId: "team:7", role: "Consumer" }],
    });
    expect(await slugsOf("otro", "team:7")).toEqual(["fleet", "sales"]);
  });

  it("lets only who manages a dashboard change who sees it", async () => {
    const { call } = setup();
    const save = (user: string, slug: string, visibility?: string) =>
      call(
        user,
        "PUT",
        `/dashboards/${slug}`,
        sampleConfig({ name: slug, ...(visibility ? { visibility } : {}) }),
      );
    // An Editor edits someone else's dashboard, but not who sees it.
    expect((await save("editor", "sales")).status).toBe(200);
    expect((await save("editor", "sales", "restricted")).status).toBe(403);
    // Its creator, and the scope's owners, may.
    expect((await save("editor", "fleet", "restricted")).status).toBe(200);
    expect((await save("owner", "sales", "restricted")).status).toBe(200);
    // A new dashboard is saved restricted by whoever creates it.
    expect((await save("editor", "brand-new", "restricted")).status).toBe(200);
  });

  it("hides a dashboard with the restricted folder it is in", async () => {
    const { call, createFolder, slugsOf, restrictFolder } = setup();
    const ops = await createFolder("owner", "Ops");
    expect(
      (
        await call("owner", "PUT", "/dashboards/sales/folder", {
          folderId: ops.id,
        })
      ).status,
    ).toBe(204);
    expect(await slugsOf("lector")).toEqual(["fleet", "sales"]);
    await restrictFolder("owner", ops.id);
    // lector created "sales", but cannot see the folder it is in.
    expect(await slugsOf("lector")).toEqual(["fleet"]);
    expect((await call("lector", "GET", "/dashboards/sales")).status).toBe(403);
  });

  it("answers a folder inside a hidden one as absent", async () => {
    const { call, createFolder, restrictFolder } = setup();
    const ops = await createFolder("owner", "Ops");
    const daily = await createFolder("owner", "Daily", ops.id);
    await restrictFolder("owner", ops.id);
    expect(
      (await call("editor", "PATCH", `/folders/${daily.id}`, { name: "X" }))
        .status,
    ).toBe(404);
  });
});

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

const scope = { tenantId: "acme", scopeId: "ops" };

async function setup() {
  const memberships = { acme: { ops: { viewer: "Consumer" as const } } };
  const folders = createMemoryFolderStore();
  const privateFolder = await folders.create(
    scope,
    {
      name: "Private",
      parentId: null,
      visibility: "restricted",
    },
    "owner",
  );
  const publicFolder = await folders.create(
    scope,
    { name: "Public", parentId: null },
    "owner",
  );
  const store = createMemoryStore({
    seed: [
      {
        ref: { ...scope, slug: "fleet" },
        record: { config: sampleConfig() },
      },
    ],
  });
  const handler = createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    folders,
  });
  const call = (path: string) =>
    handler(
      new Request(`http://localhost/tenants/acme/scopes/ops/${path}`, {
        headers: { "x-dev-user": "viewer" },
      }),
    );
  return { folders, privateFolder, publicFolder, call };
}

describe("folder listing snapshots", () => {
  it("returns the same folder location whose visibility it checked", async () => {
    const { folders, privateFolder, publicFolder, call } = await setup();
    const list = folders.list.bind(folders);
    let reads = 0;
    folders.list = async (target) => {
      reads++;
      return (await list(target)).map((folder) =>
        reads > 1 && folder.id === publicFolder.id
          ? { ...folder, parentId: privateFolder.id }
          : folder,
      );
    };
    const response = await call("folders");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: publicFolder.id,
          name: "Public",
          parentId: null,
          role: "Consumer",
        },
      ],
    });
  });

  it("does not attach a private location read after dashboard filtering", async () => {
    const { folders, privateFolder, call } = await setup();
    let reads = 0;
    folders.placements = async () =>
      ++reads === 1 ? new Map() : new Map([["fleet", privateFolder.id]]);
    const response = await call("dashboards");
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as {
      data: { slug: string; folderId?: string }[];
    };
    expect(data).toHaveLength(1);
    expect(data[0]?.folderId).toBeUndefined();
  });
});

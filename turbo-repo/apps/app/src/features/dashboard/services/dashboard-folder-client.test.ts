import { describe, expect, it, vi } from "vitest";
import { createDashboardFolderClient } from "./dashboard-folder-client";
import { DashboardApiError } from "./dashboard-server-client";

function clientAnswering(status: number, body: unknown = null) {
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    body === null
      ? new Response(null, { status })
      : Response.json(body, { status })
  );
  return createDashboardFolderClient("acme", fetchImpl);
}

describe("dashboard folder client", () => {
  it("lists no folders or stars where they are not served", async () => {
    const client = clientAnswering(404);
    await expect(client.listFolders()).resolves.toEqual([]);
    await expect(client.listStars()).resolves.toEqual([]);
  });

  it("still fails on any other refusal", async () => {
    const client = clientAnswering(403);
    await expect(client.listFolders()).rejects.toBeInstanceOf(
      DashboardApiError
    );
    await expect(client.listStars()).rejects.toMatchObject({ status: 403 });
  });

  it("reads the caller's recent opens, asking for a limit", async () => {
    const open = { slug: "fleet", openedAt: "2026-11-23T14:05:00Z" };
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ data: [open] })
    );
    const client = createDashboardFolderClient("acme", fetchImpl);
    await expect(client.listRecents(8)).resolves.toEqual([open]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "/app/api/dashboard-recents?org=acme&limit=8"
    );
  });

  it("has no recents, and notes no opens, where they are not served", async () => {
    const client = clientAnswering(404);
    await expect(client.listRecents(8)).resolves.toEqual([]);
    await expect(client.recordOpen("fleet")).resolves.toBeUndefined();
  });

  it("notes an open with a bodiless PUT", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 })
    );
    await createDashboardFolderClient("acme", fetchImpl).recordOpen("fleet");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app/api/dashboards/fleet/open?org=acme",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("reads the folders the server lists", async () => {
    const folder = { id: "f1", name: "Ops", parentId: null };
    const client = clientAnswering(200, { data: [folder] });
    await expect(client.listFolders()).resolves.toEqual([folder]);
  });

  it("keeps the caller's role on each folder", async () => {
    const folder = { id: "f1", name: "Ops", parentId: null, role: "Editor" };
    const client = clientAnswering(200, { data: [folder] });
    await expect(client.listFolders()).resolves.toEqual([folder]);
  });

  it("reads a folder's own permissions", async () => {
    const assignments = [{ authorityId: "team:7", role: "Coordinator" }];
    const client = clientAnswering(200, { assignments });
    // A server that does not say who sees it: the whole organization.
    await expect(client.folderPermissions("f1")).resolves.toEqual({
      assignments,
      visibility: "organization",
    });
    await expect(
      clientAnswering(200, {
        assignments,
        visibility: "restricted",
      }).folderPermissions("f1")
    ).resolves.toEqual({ assignments, visibility: "restricted" });
  });
});

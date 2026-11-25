import { beforeEach, describe, expect, it, vi } from "vitest";

const { scopeMock, forwardMock } = vi.hoisted(() => ({
  scopeMock: vi.fn(),
  forwardMock: vi.fn(),
}));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: scopeMock,
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: forwardMock,
}));

import { GET as queryCatalog } from "./[dashboard]/query-catalog/route";
import { POST as query } from "./[dashboard]/queries/[query]/route";
import { GET as list } from "./route";
import { GET as scopeCapabilities } from "../dashboard-capabilities/route";
import { GET as get, PUT as save, DELETE as remove } from "./[dashboard]/route";
import { GET as capabilities } from "./[dashboard]/capabilities/route";
import {
  GET as permissions,
  PUT as setPermissions,
} from "./[dashboard]/permissions/route";
import { PUT as fileInFolder } from "./[dashboard]/folder/route";
import { PUT as star, DELETE as unstar } from "./[dashboard]/star/route";
import { GET as listStars } from "../dashboard-stars/route";
import { PUT as recordOpen } from "./[dashboard]/open/route";
import { GET as listRecents } from "../dashboard-recents/route";
import {
  GET as listFolders,
  POST as createFolder,
} from "../dashboard-folders/route";
import {
  PATCH as updateFolder,
  DELETE as deleteFolder,
} from "../dashboard-folders/[folder]/route";
import {
  GET as folderPermissions,
  PUT as setFolderPermissions,
} from "../dashboard-folders/[folder]/permissions/route";

const context = { params: Promise.resolve({ dashboard: "fleet report" }) };
beforeEach(() => {
  scopeMock.mockReset().mockResolvedValue({
    resolved: true,
    scope: { activeOrg: { slug: "acme org" } },
  });
  forwardMock.mockReset().mockResolvedValue(new Response("{}"));
});

describe("new dashboard product routes", () => {
  it.each([
    ["GET", list, ""],
    ["GET", get, "/fleet%20report"],
    ["PUT", save, "/fleet%20report"],
    ["DELETE", remove, "/fleet%20report"],
    ["GET", capabilities, "/fleet%20report/capabilities"],
    ["GET", queryCatalog, "/fleet%20report/query-catalog"],
    ["GET", permissions, "/fleet%20report/permissions"],
    ["PUT", setPermissions, "/fleet%20report/permissions"],
    ["PUT", fileInFolder, "/fleet%20report/folder"],
    ["PUT", star, "/fleet%20report/star"],
    ["DELETE", unstar, "/fleet%20report/star"],
    ["PUT", recordOpen, "/fleet%20report/open"],
  ] as const)(
    "forwards %s through the authenticated org",
    async (method, route, suffix) => {
      const body = method === "PUT" ? { assignments: [] } : undefined;
      const request = new Request(
        "https://app.test/api/dashboards?tenantId=foreign",
        {
          method,
          body: body ? JSON.stringify(body) : undefined,
          headers: {
            "if-match": '"4"',
            Authorization: "Bearer attacker",
            "x-tenant-id": "foreign",
          },
        }
      );
      await route(request, context);
      expect(forwardMock).toHaveBeenCalledWith(
        `/api/v1/orgs/acme%20org/dashboards${suffix}`,
        {
          method,
          body,
          ifMatch: '"4"',
        }
      );
    }
  );

  it("returns scope denial before parsing malformed write bodies", async () => {
    scopeMock.mockResolvedValue({
      resolved: false,
      response: new Response(null, { status: 403 }),
    });
    const response = await save(
      new Request("https://app.test/api/dashboards/fleet", {
        method: "PUT",
        body: "invalid JSON",
      }),
      context
    );
    expect(response.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("refuses an old tab's write after switching organizations", async () => {
    const response = await save(
      new Request("https://app.test/api/dashboards/fleet?org=previous-org", {
        method: "PUT",
        body: "{}",
      }),
      context
    );
    expect(response.status).toBe(409);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without writing upstream", async () => {
    const response = await save(
      new Request("https://app.test/api/dashboards/fleet", {
        method: "PUT",
        body: "invalid JSON",
      }),
      context
    );
    expect(response.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it.each([".", "..", "a/../b"])(
    "rejects traversal identifier %s",
    async (dashboard) => {
      const response = await get(
        new Request("https://app.test/api/dashboards/fleet"),
        {
          params: Promise.resolve({ dashboard }),
        }
      );
      expect(response.status).toBe(400);
      expect(forwardMock).not.toHaveBeenCalled();
    }
  );
});

describe("dashboard folder routes", () => {
  const folder = { params: Promise.resolve({ folder: "f 1" }) };
  it.each([
    [
      "GET",
      () => listFolders(new Request("https://app.test/x")),
      "",
      undefined,
    ],
    [
      "POST",
      () =>
        createFolder(
          new Request("https://app.test/x", {
            method: "POST",
            body: JSON.stringify({ name: "Ops" }),
          })
        ),
      "",
      { name: "Ops" },
    ],
    [
      "PATCH",
      () =>
        updateFolder(
          new Request("https://app.test/x", {
            method: "PATCH",
            body: JSON.stringify({ name: "Daily" }),
          }),
          folder
        ),
      "/f%201",
      { name: "Daily" },
    ],
    [
      "DELETE",
      () =>
        deleteFolder(
          new Request("https://app.test/x", { method: "DELETE" }),
          folder
        ),
      "/f%201",
      undefined,
    ],
  ] as const)(
    "forwards %s to the org's folders",
    async (method, call, suffix, body) => {
      await call();
      expect(forwardMock).toHaveBeenCalledWith(
        `/api/v1/orgs/acme%20org/dashboard-folders${suffix}`,
        { method, body }
      );
    }
  );

  it("rejects a traversal folder id and a stale organization", async () => {
    const traversal = await deleteFolder(
      new Request("https://app.test/x", { method: "DELETE" }),
      { params: Promise.resolve({ folder: ".." }) }
    );
    expect(traversal.status).toBe(400);
    const stale = await listFolders(
      new Request("https://app.test/x?org=other")
    );
    expect(stale.status).toBe(409);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});

describe("folder permissions and the access mode", () => {
  const folder = { params: Promise.resolve({ folder: "f 1" }) };
  it("forwards a folder's own permissions", async () => {
    await folderPermissions(new Request("https://app.test/x"), folder);
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/dashboard-folders/f%201/permissions",
      { method: "GET", body: undefined }
    );
    const assignments = [{ authorityId: "team:7", role: "Editor" }];
    await setFolderPermissions(
      new Request("https://app.test/x", {
        method: "PUT",
        body: JSON.stringify({ assignments }),
      }),
      folder
    );
    expect(forwardMock).toHaveBeenLastCalledWith(
      "/api/v1/orgs/acme%20org/dashboard-folders/f%201/permissions",
      { method: "PUT", body: { assignments } }
    );
  });
});

describe("saved dashboard query route", () => {
  it("forwards only the selected organization and propagates cancellation", async () => {
    const request = new Request(
      "https://app.test/api/dashboards/fleet/queries/costs?org=acme%20org",
      {
        method: "POST",
        body: JSON.stringify({ filters: { days: 30 } }),
      }
    );
    await query(request, {
      params: Promise.resolve({ dashboard: "fleet", query: "costs" }),
    });
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboards/fleet/queries/costs",
      {
        method: "POST",
        body: { filters: { days: 30 } },
        signal: request.signal,
        timeoutMs: 30_000,
        ifMatch: undefined,
      }
    );
  });
  it.each([".", "..", "a/../b", ""])(
    "refuses unsafe query id %s",
    async (queryId) => {
      const response = await query(
        new Request("https://app.test/api/dashboards/fleet/queries/costs", {
          method: "POST",
          body: "{}",
        }),
        { params: Promise.resolve({ dashboard: "fleet", query: queryId }) }
      );
      expect(response.status).toBe(400);
      expect(forwardMock).not.toHaveBeenCalled();
    }
  );
});

describe("dashboard stars", () => {
  it("lists the signed-in user's stars in the active organization", async () => {
    await listStars(
      new Request("https://app.test/api/dashboard-stars?org=acme%20org")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboard-stars",
      { method: "GET" }
    );
  });

  it("stars with an empty body, as Next hands a bodiless PUT", async () => {
    await star(
      new Request("https://app.test/api/dashboards/fleet/star", {
        method: "PUT",
        body: "",
      }),
      context
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboards/fleet%20report/star",
      { method: "PUT", body: undefined, ifMatch: undefined }
    );
  });

  it("stars without a body", async () => {
    await star(
      new Request("https://app.test/api/dashboards/fleet/star", {
        method: "PUT",
      }),
      context
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboards/fleet%20report/star",
      { method: "PUT", body: undefined, ifMatch: undefined }
    );
  });
});

describe("dashboard recents", () => {
  it("lists the signed-in user's recent opens, passing a plain limit on", async () => {
    await listRecents(
      new Request(
        "https://app.test/api/dashboard-recents?org=acme%20org&limit=8"
      )
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboard-recents?limit=8",
      { method: "GET" }
    );
  });

  it("drops a limit that is not a plain number", async () => {
    await listRecents(
      new Request("https://app.test/api/dashboard-recents?limit=8%26x%3D1")
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboard-recents",
      { method: "GET" }
    );
  });

  it("records an open without a body", async () => {
    await recordOpen(
      new Request("https://app.test/api/dashboards/fleet/open", {
        method: "PUT",
      }),
      context
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme%20org/dashboards/fleet%20report/open",
      { method: "PUT", body: undefined, ifMatch: undefined }
    );
  });
});

describe("scope capabilities proxy", () => {
  it("uses authenticated organization context instead of browser identity or tenant headers", async () => {
    await scopeCapabilities(new Request("https://app.test/api/dashboard-capabilities?tenantId=foreign", {
      headers: { Authorization: "Bearer attacker", "x-tenant-id": "foreign" },
    }));
    expect(forwardMock).toHaveBeenCalledWith("/api/v1/orgs/acme%20org/dashboard-capabilities", {
      method: "GET",
    });
  });
  it("rejects a stale organization before forwarding", async () => {
    const response = await scopeCapabilities(new Request("https://app.test/api/dashboard-capabilities?org=old"));
    expect(response.status).toBe(409);
    expect(forwardMock).not.toHaveBeenCalled();
  });
  it("keeps scope denial without contacting the host", async () => {
    scopeMock.mockResolvedValue({ resolved: false, response: new Response(null, { status: 403 }) });
    expect((await scopeCapabilities(new Request("https://app.test/api/dashboard-capabilities"))).status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});

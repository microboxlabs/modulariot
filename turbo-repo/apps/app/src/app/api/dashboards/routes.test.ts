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

import { POST as query } from "./[dashboard]/queries/[query]/route";
import { GET as list } from "./route";
import { GET as get, PUT as save, DELETE as remove } from "./[dashboard]/route";
import { GET as capabilities } from "./[dashboard]/capabilities/route";
import {
  GET as permissions,
  PUT as setPermissions,
} from "./[dashboard]/permissions/route";

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
    ["GET", permissions, "/fleet%20report/permissions"],
    ["PUT", setPermissions, "/fleet%20report/permissions"],
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

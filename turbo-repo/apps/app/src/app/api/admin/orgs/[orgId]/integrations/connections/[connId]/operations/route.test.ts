import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), forward: vi.fn() }));
vi.mock("@/app/api/utils/organization-owner", () => ({
  requireOrganizationOwner: mocks.owner,
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: mocks.forward,
}));
const context = {
  params: Promise.resolve({ orgId: "demo org", connId: "demo/connection" }),
};
const path =
  "/api/v1/orgs/demo%20org/integrations/connections/demo%2Fconnection/operations";

beforeEach(() => {
  mocks.owner.mockReset().mockResolvedValue(null);
  mocks.forward.mockReset().mockResolvedValue(Response.json([]));
});

describe("connection operations owner proxy", () => {
  it("checks ownership before listing the connection operations", async () => {
    await GET(new Request("http://app.test/operations"), context);
    expect(mocks.owner).toHaveBeenCalledWith("demo org");
    expect(mocks.forward).toHaveBeenCalledWith(path);
  });
  it("forwards an owner's operation body and encoded resource identifiers", async () => {
    const body = {
      name: "Demo query",
      method: "POST",
      path: "/queries",
      requestSchema: {},
    };
    await POST(
      new Request("http://app.test/operations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context
    );
    expect(mocks.owner).toHaveBeenCalledWith("demo org");
    expect(mocks.forward).toHaveBeenCalledWith(path, { method: "POST", body });
  });
  it.each(["GET", "POST"])(
    "does not forward an unauthorized %s",
    async (method) => {
      const denied = new Response(null, { status: 403 });
      mocks.owner.mockResolvedValue(denied);
      const request = new Request("http://app.test/operations", {
        method,
        ...(method === "POST" ? { body: "invalid JSON" } : {}),
      });
      const response = await (method === "GET"
        ? GET(request, context)
        : POST(request, context));
      expect(response).toBe(denied);
      expect(mocks.forward).not.toHaveBeenCalled();
    }
  );
  it("rejects an owner's malformed JSON before contacting Quarkus", async () => {
    const response = await POST(
      new Request("http://app.test/operations", {
        method: "POST",
        body: "invalid JSON",
      }),
      context
    );
    expect(response.status).toBe(400);
    expect(mocks.forward).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    "invalid",
    {},
    { name: 1, method: "POST", path: "/queries" },
    { name: "Demo", method: "POST", path: "/queries", requestSchema: [] },
    { name: "Demo", method: "POST", path: "/queries", testOperation: "yes" },
  ])("rejects a malformed operation contract %j", async (body) => {
    const response = await POST(
      new Request("http://app.test/operations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context
    );
    expect(response.status).toBe(400);
    expect(mocks.forward).not.toHaveBeenCalled();
  });
  it("preserves optional contract fields and unrecognized extension fields", async () => {
    const body = {
      name: "Demo",
      method: "POST",
      path: "/queries",
      testOperation: false,
      responseSchema: {},
      extension: "demo",
    };
    await POST(
      new Request("http://app.test/operations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context
    );
    expect(mocks.forward).toHaveBeenCalledWith(path, { method: "POST", body });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = vi.fn();
const forward = vi.fn();
vi.mock("@/app/api/utils/organization-owner", () => ({
  requireOrganizationOwner: (...args: unknown[]) => owner(...args),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forward(...args),
}));
import { DELETE, GET, PATCH, POST } from "./route";

const ctx = (...path: string[]) => ({
  params: Promise.resolve({ orgId: "sample", path }),
});
const json = (method: string, body: unknown) =>
  new Request("http://localhost/x", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("geocoding integrations proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    owner.mockResolvedValue(null);
    forward.mockResolvedValue(new Response("[]"));
  });

  it("lists connections on the trips modulith with the session", async () => {
    await GET(new Request("http://localhost/x"), ctx("connections"));
    expect(forward).toHaveBeenCalledWith(
      "/api/v1/orgs/sample/integrations/connections",
      { method: "GET", body: undefined, sessionOnly: true }
    );
  });

  it("forwards a connection update with its body", async () => {
    await PATCH(json("PATCH", { name: "Mapbox" }), ctx("connections", "c-1"));
    expect(forward).toHaveBeenCalledWith(
      "/api/v1/orgs/sample/integrations/connections/c-1",
      { method: "PATCH", body: { name: "Mapbox" }, sessionOnly: true }
    );
  });

  it("refuses paths and methods outside the connection and its credential", async () => {
    const results = await Promise.all([
      GET(new Request("http://localhost/x"), ctx("templates")),
      DELETE(new Request("http://localhost/x"), ctx("connections", "c-1")),
      POST(json("POST", {}), ctx("connections", "c-1", "test")),
      DELETE(
        new Request("http://localhost/x"),
        ctx("credential-profiles", "..")
      ),
    ]);
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(forward).not.toHaveBeenCalled();
  });

  it("stops a caller who does not own the organization", async () => {
    owner.mockResolvedValue(new Response(null, { status: 403 }));
    const result = await POST(json("POST", {}), ctx("credential-profiles"));
    expect(result.status).toBe(403);
    expect(forward).not.toHaveBeenCalled();
  });
});

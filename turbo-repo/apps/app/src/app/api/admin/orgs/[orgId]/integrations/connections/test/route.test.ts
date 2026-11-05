import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), forward: vi.fn() }));
vi.mock("@/app/api/utils/organization-owner", () => ({
  requireOrganizationOwner: mocks.owner,
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: mocks.forward,
}));
const context = { params: Promise.resolve({ orgId: "demo org" }) };
beforeEach(() => {
  mocks.owner.mockReset().mockResolvedValue(null);
  mocks.forward.mockReset().mockResolvedValue(Response.json({ success: true }));
});
describe("draft connection owner proxy", () => {
  it("authorizes the owner and forwards the unsaved values without creating a connection", async () => {
    const body = {
      name: "Demo",
      providerType: "CUSTOM_HTTP",
      baseUrl: "https://bigquery.googleapis.com",
      credentialProfileId: "demo-google",
    };
    await POST(
      new Request("https://app.example.invalid/test", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context
    );
    expect(mocks.owner).toHaveBeenCalledWith("demo org");
    expect(mocks.forward).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/orgs/demo%20org/integrations/connections/test",
      { method: "POST", body }
    );
  });
  it("does not parse or forward a non-owner request", async () => {
    const denied = new Response(null, { status: 403 });
    mocks.owner.mockResolvedValue(denied);
    expect(
      await POST(
        new Request("https://app.example.invalid/test", {
          method: "POST",
          body: "invalid",
        }),
        context
      )
    ).toBe(denied);
    expect(mocks.forward).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON before contacting the backend", async () => {
    const result = await POST(
      new Request("https://app.example.invalid/test", {
        method: "POST",
        body: "invalid",
      }),
      context
    );
    expect(result.status).toBe(400);
    expect(mocks.forward).not.toHaveBeenCalled();
  });
});

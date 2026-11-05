import { beforeEach, describe, expect, it, vi } from "vitest";

const { forwardToStreamhubModulith } = vi.hoisted(() => ({
  forwardToStreamhubModulith: vi.fn(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith,
}));

import { DELETE, GET, POST } from "./route";

const PATH = "/api/v1/platform/orgs/acme%20sa/geocoding-connection";
const params = { params: Promise.resolve({ slug: "acme sa" }) };
const request = new Request("http://localhost");

beforeEach(() => {
  forwardToStreamhubModulith.mockReset();
  forwardToStreamhubModulith.mockResolvedValue({ ok: true });
});

describe("organization geocoding connection proxy", () => {
  it("reads with the session", async () => {
    await GET(request, params);

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      sessionOnly: true,
    });
  });

  it("forwards a connect", async () => {
    await POST(request, params);

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      method: "POST",
      sessionOnly: true,
    });
  });

  it("forwards a removal", async () => {
    await DELETE(request, params);

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      method: "DELETE",
      sessionOnly: true,
    });
  });
});

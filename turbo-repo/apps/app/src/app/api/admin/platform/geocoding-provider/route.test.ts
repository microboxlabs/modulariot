import { beforeEach, describe, expect, it, vi } from "vitest";

const { forwardToStreamhubModulith } = vi.hoisted(() => ({
  forwardToStreamhubModulith: vi.fn(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith,
}));

import { DELETE, GET, PUT } from "./route";

const PATH = "/api/v1/platform/geocoding-provider";

beforeEach(() => {
  forwardToStreamhubModulith.mockReset();
  forwardToStreamhubModulith.mockResolvedValue({ ok: true });
});

describe("platform geocoding provider proxy", () => {
  it("reads with the session", async () => {
    await GET();

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      sessionOnly: true,
    });
  });

  it("forwards the body of a save", async () => {
    const body = { provider: "mapbox", token: "pk.x", permanent: true };
    await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      method: "PUT",
      body,
      sessionOnly: true,
    });
  });

  it("refuses a body that is not JSON", async () => {
    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: "{" })
    );

    expect(response.status).toBe(400);
    expect(forwardToStreamhubModulith).not.toHaveBeenCalled();
  });

  it("forwards a removal", async () => {
    await DELETE();

    expect(forwardToStreamhubModulith).toHaveBeenCalledWith(PATH, {
      method: "DELETE",
      sessionOnly: true,
    });
  });
});

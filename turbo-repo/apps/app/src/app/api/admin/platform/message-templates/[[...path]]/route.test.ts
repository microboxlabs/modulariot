import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const forwardMock = vi.fn();

vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import * as route from "./route";

const ctx = (path?: string[]) => ({ params: Promise.resolve({ path }) });
const BASE = "/api/v1/platform/message-templates";

describe("/api/admin/platform/message-templates/[[...path]]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("exposes only the methods the modulith serves", () => {
    expect(Object.keys(route).sort()).toEqual(["GET", "PUT"]);
  });

  it("reads and saves a template with the user's session", async () => {
    await route.GET(new Request("http://x"), ctx(["panic-check"]));
    const body = { name: "Pánico" };
    await route.PUT(
      new Request("http://x", { method: "PUT", body: JSON.stringify(body) }),
      ctx(["panic-check"])
    );
    expect(forwardMock).toHaveBeenNthCalledWith(1, `${BASE}/panic-check`, {
      sessionOnly: true,
    });
    expect(forwardMock).toHaveBeenNthCalledWith(2, `${BASE}/panic-check`, {
      method: "PUT",
      body,
      sessionOnly: true,
    });
  });

  it("refuses paths that could leave the templates API", async () => {
    const res = await route.GET(new Request("http://x"), ctx([".."]));
    expect(res.status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});

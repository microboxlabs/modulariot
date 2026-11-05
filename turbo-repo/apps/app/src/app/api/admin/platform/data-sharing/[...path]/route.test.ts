import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const forwardMock = vi.fn();

vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET, POST } from "./route";

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/admin/platform/data-sharing/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("forwards reads with the user's session", async () => {
    await GET(new Request("http://x"), ctx(["orgs", "gps-austral", "assets"]));
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/platform/data-sharing/orgs/gps-austral/assets",
      { sessionOnly: true }
    );
  });

  it("forwards a create with its body", async () => {
    const body = { sourceOrg: "a", targetOrg: "b", scope: "ALL" };
    await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify(body) }),
      ctx(["shares"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/platform/data-sharing/shares",
      { method: "POST", body, sessionOnly: true }
    );
  });

  it("refuses paths that could leave the data-sharing API", async () => {
    for (const path of [[".."], ["orgs", "a/b"], ["orgs", "a?x=1"]]) {
      const res = await GET(new Request("http://x"), ctx(path));
      expect(res.status).toBe(400);
    }
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{nope" }),
      ctx(["shares"])
    );
    expect(res.status).toBe(400);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const forwardMock = vi.fn();
const evictMock = vi.fn();

vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardMock(...args),
}));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  evictAllScopeCaches: () => evictMock(),
}));

import { POST } from "./route";

const post = (body: string) =>
  POST(
    new Request("http://x/app/api/me/invitations/accept", {
      method: "POST",
      body,
    })
  );

describe("/api/me/invitations/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the token and refreshes the caller's organizations", async () => {
    forwardMock.mockResolvedValue(NextResponse.json({ baseRole: "MEMBER" }));
    const res = await post(JSON.stringify({ token: "t-1" }));
    expect(res.status).toBe(200);
    expect(forwardMock).toHaveBeenCalledWith("/api/v1/me/invitations/accept", {
      method: "POST",
      body: { token: "t-1" },
    });
    expect(evictMock).toHaveBeenCalledOnce();
  });

  it("keeps the scope cache when the modulith refuses", async () => {
    forwardMock.mockResolvedValue(
      NextResponse.json({ error: "other email" }, { status: 403 })
    );
    const res = await post(JSON.stringify({ token: "t-1" }));
    expect(res.status).toBe(403);
    expect(evictMock).not.toHaveBeenCalled();
  });

  it("refuses a body without a token", async () => {
    expect((await post("{}")).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});

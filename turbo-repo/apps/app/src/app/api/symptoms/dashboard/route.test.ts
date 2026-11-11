import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { GET } from "./route";

const CONDITIONS = "/api/v1/orgs/acme/control-tower/map/conditions";

describe("GET /api/symptoms/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ "Code Black": 2, Ignored: 1 })
    );
  });

  it("answers the counts by condition", async () => {
    const res = await GET(new NextRequest("http://x/d"));

    expect(forwardMock).toHaveBeenCalledWith(CONDITIONS, { method: "GET" });
    expect(await res.json()).toMatchObject({ codeBlack: 2, ignored: 1, critic: 0 });
  });

  it.each(["required", "none", "all"])(
    "passes operator=%s to the modulith",
    async (operator) => {
      await GET(new NextRequest(`http://x/d?operator=${operator}`));

      expect(forwardMock).toHaveBeenCalledWith(
        `${CONDITIONS}?operator=${operator}`,
        { method: "GET" }
      );
    }
  );

  it("drops an operator value the modulith does not know", async () => {
    await GET(new NextRequest("http://x/d?operator=junk"));

    expect(forwardMock).toHaveBeenCalledWith(CONDITIONS, { method: "GET" });
  });
});

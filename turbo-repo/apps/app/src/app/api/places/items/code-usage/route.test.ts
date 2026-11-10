import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const resolveTenantScopeMock = vi.fn();
const forwardToQuarkusMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: (...args: unknown[]) => resolveTenantScopeMock(...args),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardToQuarkusMock(...args),
}));

import { GET } from "./route";

const pedir = (query: string) =>
  new Request(`http://localhost/app/api/places/items/code-usage${query}`);

describe("GET /app/api/places/items/code-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveTenantScopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardToQuarkusMock.mockResolvedValue(NextResponse.json({ inUse: false }));
  });

  it("asks the modulith for the active organization, with the code encoded", async () => {
    const res = await GET(pedir("?code=SCL%2001"));
    expect(res.status).toBe(200);
    expect(forwardToQuarkusMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/places/items/code-usage?code=SCL%2001"
    );
  });

  it("needs a code", async () => {
    const res = await GET(pedir("?code=%20"));
    expect(res.status).toBe(400);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });

  it("answers with the scope's refusal when there is no organization", async () => {
    resolveTenantScopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({ error: "no" }, { status: 403 }),
    });
    const res = await GET(pedir("?code=SCL"));
    expect(res.status).toBe(403);
    expect(forwardToQuarkusMock).not.toHaveBeenCalled();
  });
});

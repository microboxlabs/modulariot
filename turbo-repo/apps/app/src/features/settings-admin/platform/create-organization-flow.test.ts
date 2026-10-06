import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../data/json-client";
import { createOrganizationWithOwner } from "./create-organization-flow";

const organization = {
  slug: "acme",
  name: "Acme",
  tenantClientId: "client-1",
  membershipSource: "NATIVE" as const,
};
const OWNER = "owner@example.test";

function calls() {
  return {
    create: vi.fn().mockResolvedValue({}),
    setOwners: vi.fn().mockResolvedValue(undefined),
  };
}

function apiError(status: number, message: string) {
  return new ApiError({ status, url: "/app/api/admin/platform/orgs", message });
}

describe("createOrganizationWithOwner", () => {
  it("creates the organization, then names its owner", async () => {
    const c = calls();

    const outcome = await createOrganizationWithOwner(
      organization,
      OWNER,
      null,
      c
    );

    expect(outcome).toEqual({ kind: "created" });
    expect(c.create).toHaveBeenCalledWith(organization);
    expect(c.setOwners).toHaveBeenCalledWith("acme", [OWNER]);
  });

  it("reports a taken identifier without trying the owner step", async () => {
    const c = calls();
    c.create.mockRejectedValue(apiError(409, "Slug already in use: acme"));

    const outcome = await createOrganizationWithOwner(
      organization,
      OWNER,
      null,
      c
    );

    expect(outcome).toEqual({ kind: "slugTaken" });
    expect(c.setOwners).not.toHaveBeenCalled();
  });

  it("keeps the cause when the owner step fails after the organization exists", async () => {
    const c = calls();
    c.setOwners.mockRejectedValue(apiError(400, "Unknown organization role"));

    const outcome = await createOrganizationWithOwner(
      organization,
      OWNER,
      null,
      c
    );

    expect(outcome).toEqual({
      kind: "ownerFailed",
      detail: "Unknown organization role",
    });
  });

  it("retries only the owner step for an organization it already created", async () => {
    const c = calls();

    const outcome = await createOrganizationWithOwner(
      organization,
      OWNER,
      "acme",
      c
    );

    expect(outcome).toEqual({ kind: "created" });
    expect(c.create).not.toHaveBeenCalled();
    expect(c.setOwners).toHaveBeenCalledWith("acme", [OWNER]);
  });

  it("creates again when the pending owner was for another identifier", async () => {
    const c = calls();

    await createOrganizationWithOwner(organization, OWNER, "other", c);

    expect(c.create).toHaveBeenCalledOnce();
  });
});

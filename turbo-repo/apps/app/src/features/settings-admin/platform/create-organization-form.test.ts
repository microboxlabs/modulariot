import { describe, expect, it } from "vitest";
import {
  EMPTY_ORGANIZATION_DRAFT,
  toOrganizationRequest,
} from "./create-organization-form";

const valid = {
  slug: " acme-fleet ",
  name: " Acme Fleet ",
  tenantClientId: " client-123 ",
  ownerEmail: " Owner@Example.com ",
};

describe("toOrganizationRequest", () => {
  it("trims the fields, lower-cases the owner and asks for native membership", () => {
    expect(toOrganizationRequest(valid)).toEqual({
      ok: true,
      value: {
        organization: {
          slug: "acme-fleet",
          name: "Acme Fleet",
          tenantClientId: "client-123",
          membershipSource: "NATIVE",
        },
        ownerEmail: "owner@example.com",
      },
    });
  });

  it.each(["", "ab", "Acme", "-acme", "acme-", "ac me"])(
    "refuses the slug %j",
    (slug) => {
      expect(toOrganizationRequest({ ...valid, slug })).toEqual({
        ok: false,
        error: "slug",
      });
    }
  );

  it("names the first missing field", () => {
    expect(toOrganizationRequest({ ...valid, name: " " })).toEqual({
      ok: false,
      error: "name",
    });
    expect(toOrganizationRequest({ ...valid, tenantClientId: "" })).toEqual({
      ok: false,
      error: "tenantClientId",
    });
    expect(toOrganizationRequest({ ...valid, ownerEmail: "owner" })).toEqual({
      ok: false,
      error: "ownerEmail",
    });
    expect(toOrganizationRequest(EMPTY_ORGANIZATION_DRAFT)).toEqual({
      ok: false,
      error: "slug",
    });
  });
});

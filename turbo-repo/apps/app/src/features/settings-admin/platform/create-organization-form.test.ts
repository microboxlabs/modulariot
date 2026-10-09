import { describe, expect, it } from "vitest";
import {
  EMPTY_ORGANIZATION_DRAFT,
  slugFromClientName,
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

  it("names the first bad field, in the order the form shows them", () => {
    expect(toOrganizationRequest({ ...valid, name: " " })).toEqual({
      ok: false,
      error: "name",
    });
    expect(
      toOrganizationRequest({ ...valid, tenantClientId: "x".repeat(256) })
    ).toEqual({
      ok: false,
      error: "tenantClientId",
    });
    expect(toOrganizationRequest({ ...valid, ownerEmail: "owner" })).toEqual({
      ok: false,
      error: "ownerEmail",
    });
    expect(toOrganizationRequest(EMPTY_ORGANIZATION_DRAFT)).toEqual({
      ok: false,
      error: "name",
    });
  });

  it("refuses a name or client id longer than its column", () => {
    const long = "x".repeat(256);
    expect(toOrganizationRequest({ ...valid, name: long })).toEqual({
      ok: false,
      error: "name",
    });
    expect(toOrganizationRequest({ ...valid, tenantClientId: long })).toEqual({
      ok: false,
      error: "tenantClientId",
    });
  });
});

describe("an organization without a client id", () => {
  it("leaves the client id out, so the platform creates the application", () => {
    const result = toOrganizationRequest({ ...valid, tenantClientId: "  " });
    expect(result.ok && result.value.organization).toEqual({
      slug: "acme-fleet",
      name: "Acme Fleet",
      membershipSource: "NATIVE",
    });
  });
});

describe("slugFromClientName", () => {
  it.each([
    ["corp:acme-gps", "acme-gps"],
    ["corp:Acme Tracker", "acme-tracker"],
    ["Señal_GPS", "senal-gps"],
    ["corp:ab", ""],
    [null, ""],
  ])("turns %j into %j", (name, slug) => {
    expect(slugFromClientName(name)).toBe(slug);
  });
});

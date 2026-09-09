import { describe, expect, it } from "vitest";
import { matchRoute } from "./routes";

describe("matchRoute", () => {
  it("matches the contract's four shapes", () => {
    expect(matchRoute("/tenants/acme/scopes/ops/dashboards")).toEqual({
      route: "dashboards",
      tenantId: "acme",
      scopeId: "ops",
    });
    expect(matchRoute("/tenants/acme/scopes/ops/dashboards/fleet")).toEqual({
      route: "dashboard",
      tenantId: "acme",
      scopeId: "ops",
      slug: "fleet",
    });
    expect(
      matchRoute("/tenants/acme/scopes/ops/dashboards/fleet/capabilities"),
    ).toEqual({
      route: "capabilities",
      tenantId: "acme",
      scopeId: "ops",
      slug: "fleet",
    });
    expect(
      matchRoute("/tenants/acme/scopes/ops/dashboards/fleet/permissions"),
    ).toEqual({
      route: "permissions",
      tenantId: "acme",
      scopeId: "ops",
      slug: "fleet",
    });
  });

  it("tolerates trailing and doubled slashes", () => {
    expect(matchRoute("/tenants/acme/scopes/ops/dashboards/")).toEqual({
      route: "dashboards",
      tenantId: "acme",
      scopeId: "ops",
    });
    expect(matchRoute("//tenants//acme//scopes//ops//dashboards")).toEqual({
      route: "dashboards",
      tenantId: "acme",
      scopeId: "ops",
    });
  });

  it("decodes ids, so a slash inside one survives the round trip", () => {
    expect(
      matchRoute("/tenants/ac%2Fme/scopes/o%2Fps/dashboards/q1%20report"),
    ).toEqual({
      route: "dashboard",
      tenantId: "ac/me",
      scopeId: "o/ps",
      slug: "q1 report",
    });
  });

  it("refuses anything it does not recognise instead of guessing", () => {
    for (const path of [
      "/",
      "/tenants",
      "/tenants/acme",
      "/tenants/acme/scopes",
      "/tenants/acme/scopes/ops",
      "/tenants/acme/scopes/ops/widgets",
      "/tenants/acme/scopes/ops/dashboards/fleet/unknown",
      "/tenants/acme/scopes/ops/dashboards/fleet/permissions/extra",
      "/other/acme/scopes/ops/dashboards",
      // The pre-tenant shape. Refused rather than defaulted: a default would
      // be one tenant everybody's old links quietly landed in.
      "/scopes/ops/dashboards",
    ]) {
      expect(matchRoute(path), path).toBeNull();
    }
  });

  it("refuses empty ids rather than treating them as a wildcard", () => {
    expect(matchRoute("/tenants//scopes/ops/dashboards")).toBeNull();
    expect(matchRoute("/tenants/acme/scopes//dashboards")).toBeNull();
    expect(
      matchRoute("/tenants/acme/scopes/ops/dashboards/%20"),
    ).not.toBeNull();
  });

  it("returns null for a malformed percent sequence instead of throwing", () => {
    const bad = "/tenants/%E0%A4%A/scopes/ops/dashboards";
    expect(() => matchRoute(bad)).not.toThrow();
    expect(matchRoute(bad)).toBeNull();
    expect(matchRoute("/tenants/acme/scopes/%E0%A4%A/dashboards")).toBeNull();
  });
});

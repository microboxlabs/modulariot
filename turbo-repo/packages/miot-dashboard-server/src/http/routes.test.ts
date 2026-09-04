import { describe, expect, it } from "vitest";
import { matchRoute } from "./routes";

describe("matchRoute", () => {
  it("matches the contract's four shapes", () => {
    expect(matchRoute("/scopes/ops/dashboards")).toEqual({
      route: "dashboards",
      scopeId: "ops",
    });
    expect(matchRoute("/scopes/ops/dashboards/fleet")).toEqual({
      route: "dashboard",
      scopeId: "ops",
      slug: "fleet",
    });
    expect(matchRoute("/scopes/ops/dashboards/fleet/capabilities")).toEqual({
      route: "capabilities",
      scopeId: "ops",
      slug: "fleet",
    });
    expect(matchRoute("/scopes/ops/dashboards/fleet/permissions")).toEqual({
      route: "permissions",
      scopeId: "ops",
      slug: "fleet",
    });
  });

  it("tolerates trailing and doubled slashes", () => {
    expect(matchRoute("/scopes/ops/dashboards/")).toEqual({
      route: "dashboards",
      scopeId: "ops",
    });
    expect(matchRoute("//scopes//ops//dashboards")).toEqual({
      route: "dashboards",
      scopeId: "ops",
    });
  });

  it("decodes ids, so a slash inside one survives the round trip", () => {
    expect(matchRoute("/scopes/ac%2Fme/dashboards/q1%20report")).toEqual({
      route: "dashboard",
      scopeId: "ac/me",
      slug: "q1 report",
    });
  });

  it("refuses anything it does not recognise instead of guessing", () => {
    for (const path of [
      "/",
      "/scopes",
      "/scopes/ops",
      "/scopes/ops/widgets",
      "/scopes/ops/dashboards/fleet/unknown",
      "/scopes/ops/dashboards/fleet/permissions/extra",
      "/other/ops/dashboards",
    ]) {
      expect(matchRoute(path), path).toBeNull();
    }
  });

  it("refuses empty ids rather than treating them as a wildcard", () => {
    expect(matchRoute("/scopes//dashboards")).toBeNull();
    expect(matchRoute("/scopes/ops/dashboards/%20")).not.toBeNull();
  });

  it("returns null for a malformed percent sequence instead of throwing", () => {
    expect(() => matchRoute("/scopes/%E0%A4%A/dashboards")).not.toThrow();
    expect(matchRoute("/scopes/%E0%A4%A/dashboards")).toBeNull();
  });
});

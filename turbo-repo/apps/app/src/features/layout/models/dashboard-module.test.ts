import { describe, expect, it } from "vitest";
import {
  dashboardModuleEnabled,
  isLegacyDashboardPath,
} from "./dashboard-module";

describe("dashboardModuleEnabled", () => {
  it("keeps only the dashboards DASHBOARD_MODULE names", () => {
    expect(dashboardModuleEnabled("server", "server")).toBe(true);
    expect(dashboardModuleEnabled("legacy", "server")).toBe(false);
    expect(dashboardModuleEnabled("legacy", " Legacy ")).toBe(true);
    expect(dashboardModuleEnabled("server", "legacy")).toBe(false);
  });

  it("shows both when unset or unknown", () => {
    for (const setting of [undefined, null, "", "both"]) {
      expect(dashboardModuleEnabled("legacy", setting)).toBe(true);
      expect(dashboardModuleEnabled("server", setting)).toBe(true);
    }
  });
});

describe("isLegacyDashboardPath", () => {
  it("matches Home and its dashboards only", () => {
    expect(isLegacyDashboardPath("/home")).toBe(true);
    expect(isLegacyDashboardPath("/home/fleet")).toBe(true);
    expect(isLegacyDashboardPath("/homeland")).toBe(false);
    expect(isLegacyDashboardPath("/dashboards")).toBe(false);
  });
});

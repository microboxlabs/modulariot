import { describe, expect, it } from "vitest";

import {
  DASHBOARD_ROLES,
  type DashboardRole,
  highestRole,
  isDashboardRole,
  roleAtLeast,
} from "./roles";

describe("isDashboardRole", () => {
  it.each([...DASHBOARD_ROLES])("accepts %s", (role) => {
    expect(isDashboardRole(role)).toBe(true);
  });

  // Host role names arrive as free text, so a near miss must not be coerced.
  it.each(["coordinator", "COORDINATOR", "Coordinator ", "Admin", "", null, 3])(
    "refuses %o",
    (value) => {
      expect(isDashboardRole(value)).toBe(false);
    },
  );
});

describe("the ordering", () => {
  // The whole matrix, not a few pairs: one mis-ranked entry is the fault.
  it("is total, and consistent with the declaration order", () => {
    DASHBOARD_ROLES.forEach((role, roleIndex) => {
      DASHBOARD_ROLES.forEach((floor, floorIndex) => {
        expect(roleAtLeast(role, floor)).toBe(roleIndex >= floorIndex);
      });
    });
  });

  it("is reflexive", () => {
    for (const role of DASHBOARD_ROLES) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });
});

describe("highestRole", () => {
  it("returns null for no roles at all", () => {
    expect(highestRole([])).toBeNull();
  });

  it("picks the strongest whatever order they arrive in", () => {
    const some: DashboardRole[] = ["Consumer", "Coordinator", "Editor"];
    expect(highestRole(some)).toBe("Coordinator");
    expect(highestRole([...some].reverse())).toBe("Coordinator");
  });

  it("takes any iterable, because assignments arrive as a Set", () => {
    expect(highestRole(new Set<DashboardRole>(["Contributor", "Editor"]))).toBe(
      "Editor",
    );
  });
});

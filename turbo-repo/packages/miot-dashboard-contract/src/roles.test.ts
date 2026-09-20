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

  /**
   * Host role names arrive as free text — from a membership API, a mapping
   * table, a values file. A near miss has to be refused rather than coerced,
   * because the alternative is granting the role somebody nearly named.
   */
  it.each(["coordinator", "COORDINATOR", "Coordinator ", "Admin", "", null, 3])(
    "refuses %o",
    (value) => {
      expect(isDashboardRole(value)).toBe(false);
    },
  );
});

describe("the ordering", () => {
  /**
   * The promise a host makes by mapping its roles onto ours: a higher role
   * grants at least what every lower one does. Asserted over the whole matrix
   * rather than a few pairs, because a single mis-ranked entry is exactly the
   * fault that would let a Consumer outrank a Contributor somewhere.
   */
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

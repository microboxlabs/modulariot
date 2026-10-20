import { describe, expect, it } from "vitest";
import {
  decideAccess,
  describeRule,
  parseAccessSource,
  type AccessRule,
} from "./access-control";

const KANBAN: AccessRule = {
  requiredGroups: ["GROUP_KANBAN"],
  requiredPermissions: ["coordination:kanban.view"],
};

describe("parseAccessSource", () => {
  it("defaults to groups", () => {
    expect(parseAccessSource(undefined)).toBe("groups");
    expect(parseAccessSource("")).toBe("groups");
    expect(parseAccessSource("roles")).toBe("groups");
  });

  it("accepts the three sources, ignoring case and spaces", () => {
    expect(parseAccessSource("groups")).toBe("groups");
    expect(parseAccessSource(" Shadow ")).toBe("shadow");
    expect(parseAccessSource("PERMISSIONS")).toBe("permissions");
  });
});

describe("decideAccess", () => {
  const groupOnly = { groups: ["GROUP_KANBAN"], permissions: [] };
  const permissionOnly = {
    groups: [],
    permissions: ["coordination:kanban.view"],
  };

  it("groups mode decides with groups only", () => {
    expect(decideAccess("groups", KANBAN, groupOnly).allowed).toBe(true);
    expect(decideAccess("groups", KANBAN, permissionOnly).allowed).toBe(false);
  });

  it("groups mode never reports a mismatch", () => {
    expect(decideAccess("groups", KANBAN, groupOnly).mismatch).toBe(false);
  });

  it("permissions mode decides with permissions only", () => {
    expect(decideAccess("permissions", KANBAN, groupOnly).allowed).toBe(false);
    expect(decideAccess("permissions", KANBAN, permissionOnly).allowed).toBe(
      true
    );
  });

  it("permissions mode fails closed while permissions load", () => {
    const decision = decideAccess("permissions", KANBAN, {
      groups: ["GROUP_KANBAN"],
      permissions: null,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.byPermissions).toBeNull();
  });

  it("shadow mode decides with groups and flags a disagreement", () => {
    const decision = decideAccess("shadow", KANBAN, groupOnly);
    expect(decision).toEqual({
      allowed: true,
      byGroups: true,
      byPermissions: false,
      mismatch: true,
    });
  });

  it("shadow mode reports nothing while permissions load", () => {
    const decision = decideAccess("shadow", KANBAN, {
      groups: ["GROUP_KANBAN"],
      permissions: null,
    });
    expect(decision.mismatch).toBe(false);
  });

  it("shadow mode reports nothing when both agree", () => {
    const decision = decideAccess("shadow", KANBAN, {
      groups: ["GROUP_KANBAN"],
      permissions: ["coordination:kanban.view"],
    });
    expect(decision.mismatch).toBe(false);
  });

  it("any one listed permission opens the gate", () => {
    const rule: AccessRule = {
      requiredPermissions: ["calendar:plan", "calendar:assign"],
    };
    expect(
      decideAccess("permissions", rule, {
        groups: [],
        permissions: ["calendar:assign"],
      }).allowed
    ).toBe(true);
  });

  it("ignores blocked groups when a permission decides", () => {
    const rule: AccessRule = {
      blockedGroups: ["GROUP_REVIEWER"],
      requiredPermissions: ["coordination:task.complete"],
    };
    const subject = {
      groups: ["GROUP_REVIEWER"],
      permissions: ["coordination:task.complete"],
    };
    expect(decideAccess("groups", rule, subject).allowed).toBe(false);
    expect(decideAccess("permissions", rule, subject).allowed).toBe(true);
  });

  it("decides a rule without a permission by groups in every mode", () => {
    const rule: AccessRule = { requiredGroups: ["GROUP_DHB_SALES"] };
    const subject = { groups: ["GROUP_DHB_SALES"], permissions: null };
    expect(decideAccess("permissions", rule, subject).allowed).toBe(true);
    expect(decideAccess("shadow", rule, subject).mismatch).toBe(false);
  });

  it("opens a rule that requires a permission but no group in groups mode", () => {
    const rule: AccessRule = {
      requiredPermissions: ["coordination:finished.view"],
    };
    const subject = { groups: [], permissions: [] };
    expect(decideAccess("groups", rule, subject).allowed).toBe(true);
    expect(decideAccess("permissions", rule, subject).allowed).toBe(false);
  });
});

describe("describeRule", () => {
  it("names a rule by its permissions, else by its groups", () => {
    expect(describeRule(KANBAN)).toBe("coordination:kanban.view");
    expect(describeRule({ requiredGroups: ["A", "B"] })).toBe("A|B");
    expect(describeRule({})).toBe("open");
  });
});

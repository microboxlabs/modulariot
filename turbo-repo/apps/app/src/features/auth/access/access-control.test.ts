import { describe, expect, it } from "vitest";
import { decideAccess, describeRule, type AccessRule } from "./access-control";

const KANBAN: AccessRule = {
  requiredPermissions: ["coordination:kanban.view"],
};

describe("decideAccess", () => {
  it("opens the gate with a listed permission", () => {
    expect(decideAccess(KANBAN, ["coordination:kanban.view"])).toBe(true);
  });

  it("keeps the gate closed without a listed permission", () => {
    expect(decideAccess(KANBAN, ["calendar:view"])).toBe(false);
    expect(decideAccess(KANBAN, [])).toBe(false);
  });

  it("fails closed while permissions load or when they cannot be loaded", () => {
    expect(decideAccess(KANBAN, null)).toBe(false);
  });

  it("any one listed permission opens the gate", () => {
    const rule: AccessRule = {
      requiredPermissions: ["calendar:plan", "calendar:assign"],
    };
    expect(decideAccess(rule, ["calendar:assign"])).toBe(true);
  });

  it("opens a rule without permissions, even before they load", () => {
    expect(decideAccess({}, null)).toBe(true);
    expect(decideAccess({ requiredPermissions: [] }, [])).toBe(true);
  });
});

describe("describeRule", () => {
  it("names a rule by its permissions", () => {
    expect(describeRule(KANBAN)).toBe("coordination:kanban.view");
    expect(
      describeRule({
        requiredPermissions: ["calendar:plan", "calendar:assign"],
      })
    ).toBe("calendar:plan|calendar:assign");
    expect(describeRule({})).toBe("open");
  });
});

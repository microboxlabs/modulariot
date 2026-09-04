import { describe, expect, it } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import {
  DASHBOARD_ROLES,
  FULL_CAPABILITIES,
  capabilitiesForRole,
  highestRole,
  intersectCapabilities,
  isDashboardRole,
  roleAtLeast,
} from "./roles";

describe("role vocabulary", () => {
  it("matches the wire contract exactly", () => {
    expect(DASHBOARD_ROLES).toEqual([
      "Consumer",
      "Contributor",
      "Editor",
      "Coordinator",
    ]);
  });

  it("recognises only the four roles", () => {
    for (const role of DASHBOARD_ROLES)
      expect(isDashboardRole(role)).toBe(true);
    expect(isDashboardRole("Manager")).toBe(false);
    expect(isDashboardRole("consumer")).toBe(false);
    expect(isDashboardRole(undefined)).toBe(false);
    expect(isDashboardRole(3)).toBe(false);
  });

  it("orders roles strictly", () => {
    expect(roleAtLeast("Coordinator", "Consumer")).toBe(true);
    expect(roleAtLeast("Consumer", "Coordinator")).toBe(false);
    expect(roleAtLeast("Editor", "Editor")).toBe(true);
    expect(roleAtLeast("Contributor", "Editor")).toBe(false);
  });

  it("picks the strongest role, or null when there is none", () => {
    expect(highestRole([])).toBeNull();
    expect(highestRole(["Consumer"])).toBe("Consumer");
    expect(highestRole(["Consumer", "Coordinator", "Editor"])).toBe(
      "Coordinator",
    );
  });
});

describe("capabilitiesForRole", () => {
  it("Consumer is view-only", () => {
    expect(capabilitiesForRole("Consumer")).toEqual(NO_CAPABILITIES);
  });

  it("Contributor is view-only unless owner", () => {
    expect(capabilitiesForRole("Contributor")).toEqual(NO_CAPABILITIES);
    expect(capabilitiesForRole("Contributor", { isOwner: true })).toEqual({
      readOnly: false,
      canEdit: true,
      canShare: false,
      canManagePermissions: false,
      canDelete: false,
    });
  });

  it("Editor edits and shares but neither deletes nor manages access", () => {
    expect(capabilitiesForRole("Editor")).toEqual({
      readOnly: false,
      canEdit: true,
      canShare: true,
      canManagePermissions: false,
      canDelete: false,
    });
  });

  it("Coordinator has everything", () => {
    expect(capabilitiesForRole("Coordinator")).toEqual(FULL_CAPABILITIES);
  });

  it("returns a fresh object every call", () => {
    const a = capabilitiesForRole("Coordinator");
    a.canDelete = false;
    expect(capabilitiesForRole("Coordinator").canDelete).toBe(true);
    expect(FULL_CAPABILITIES.canDelete).toBe(true);
  });

  it("frozen constants refuse mutation", () => {
    expect(() => {
      (FULL_CAPABILITIES as { canDelete: boolean }).canDelete = false;
    }).toThrow(TypeError);
  });
});

describe("intersectCapabilities", () => {
  it("only narrows", () => {
    const editor = capabilitiesForRole("Editor");
    expect(intersectCapabilities(editor, FULL_CAPABILITIES)).toEqual(editor);
    expect(intersectCapabilities(editor, NO_CAPABILITIES)).toEqual(
      NO_CAPABILITIES,
    );
    expect(
      intersectCapabilities(FULL_CAPABILITIES, {
        ...FULL_CAPABILITIES,
        canDelete: false,
      }),
    ).toEqual({ ...FULL_CAPABILITIES, canDelete: false });
  });

  it("readOnly wins when either side is read-only", () => {
    expect(
      intersectCapabilities(FULL_CAPABILITIES, {
        ...FULL_CAPABILITIES,
        readOnly: true,
      }).readOnly,
    ).toBe(true);
  });
});

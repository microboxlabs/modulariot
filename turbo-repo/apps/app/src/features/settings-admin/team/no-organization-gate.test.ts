import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { isPlatformOwnerPath } from "./no-organization-gate";

describe("isPlatformOwnerPath", () => {
  it.each([
    "/app/es/users/settings/platform",
    "/app/en/users/settings/organizations",
  ])("lets a platform owner reach %s without an organization", (path) => {
    expect(isPlatformOwnerPath(path)).toBe(true);
  });

  it.each([
    "/app/es/symptoms",
    "/app/es/users/settings/team",
    "/app/es/users/settings/platform/other",
  ])("keeps %s behind the gate", (path) => {
    expect(isPlatformOwnerPath(path)).toBe(false);
  });
});

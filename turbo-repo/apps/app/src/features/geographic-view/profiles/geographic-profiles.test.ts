import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEOGRAPHIC_PROFILE,
  GEOGRAPHIC_PROFILES,
  profileHasCapability,
} from "./geographic-profiles";

describe("geographic profiles", () => {
  it("defaults to the enabled admin profile", () => {
    expect(DEFAULT_GEOGRAPHIC_PROFILE).toBe("admin");
    expect(GEOGRAPHIC_PROFILES.admin.enabled).toBe(true);
    expect(GEOGRAPHIC_PROFILES.other.enabled).toBe(false);
  });

  it("gives admin the places editor and keeps other empty", () => {
    expect(profileHasCapability("admin", "placesEditor")).toBe(true);
    expect(profileHasCapability("other", "placesEditor")).toBe(false);
  });
});

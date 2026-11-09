import { describe, expect, it } from "vitest";
import { tripPlateNow } from "./plate-change";

describe("tripPlateNow", () => {
  it("returns the trip's plate after a truck change", () => {
    expect(tripPlateNow("KTKJ69", "KGXR80")).toBe("KGXR80");
  });

  it("returns null when the trip is still on the case's truck", () => {
    expect(tripPlateNow("KGXR80", "kgxr80 ")).toBeNull();
  });

  it("returns null without both plates", () => {
    expect(tripPlateNow("KTKJ69", null)).toBeNull();
    expect(tripPlateNow(undefined, "KGXR80")).toBeNull();
  });
});

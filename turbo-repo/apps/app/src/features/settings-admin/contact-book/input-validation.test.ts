import { describe, expect, it } from "vitest";
import { inputValidationColor } from "./input-validation";

describe("inputValidationColor", () => {
  it("is gray while empty, whatever the validity", () => {
    expect(inputValidationColor("  ", false)).toBe("gray");
  });

  it("is green for a valid value and red for an invalid one", () => {
    expect(inputValidationColor("ana@gmail.com", true)).toBe("success");
    expect(inputValidationColor("ana", false)).toBe("failure");
  });
});

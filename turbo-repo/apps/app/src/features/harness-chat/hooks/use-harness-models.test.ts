import { describe, expect, it } from "vitest";
import { modelLabel } from "./use-harness-models";

describe("modelLabel", () => {
  it("adds the multiplier only above 1", () => {
    const info = {
      default: "a",
      models: ["a", "b", "c"],
      multipliers: { a: 1, b: 3 },
    };
    expect(modelLabel(info, "a")).toBe("a");
    expect(modelLabel(info, "b")).toBe("b ×3");
    expect(modelLabel(info, "c")).toBe("c");
    expect(modelLabel({ default: null, models: ["a"] }, "a")).toBe("a");
  });
});

import { describe, expect, it } from "vitest";
import { avatarColor } from "./org-switcher";

describe("avatarColor", () => {
  // Long slugs overflow 32 bits; these colours come from the original `| 0` hash.
  it.each([
    ["microboxlabs", "bg-violet-100"],
    ["platform", "bg-violet-100"],
    ["logistica-andina-sa", "bg-rose-100"],
  ])("keeps the colour of %s", (slug, color) => {
    expect(avatarColor(slug)).toContain(color);
  });
});

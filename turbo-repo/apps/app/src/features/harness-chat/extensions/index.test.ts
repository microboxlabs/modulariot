import { describe, expect, it } from "vitest";
import { DEFAULT_HARNESS_EXTENSIONS, resolveDefaultHarnessExtensions } from "./index";

describe("resolveDefaultHarnessExtensions", () => {
  it("drops create_story when storytelling is off", () => {
    const tools = resolveDefaultHarnessExtensions({ storytellingEnabled: false }).map(
      (e) => e.toolName,
    );
    expect(tools).not.toContain("create_story");
    expect(tools).toContain("ask_user_question");
    expect(tools).toContain("show_dashlet");
  });

  it("keeps every default card when storytelling is on", () => {
    const tools = resolveDefaultHarnessExtensions({ storytellingEnabled: true }).map(
      (e) => e.toolName,
    );
    expect(tools).toEqual(DEFAULT_HARNESS_EXTENSIONS.map((e) => e.toolName));
  });
});

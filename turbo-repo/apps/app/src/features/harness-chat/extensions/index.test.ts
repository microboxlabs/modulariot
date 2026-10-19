import { describe, expect, it } from "vitest";
import { DEFAULT_HARNESS_EXTENSIONS, resolveDefaultHarnessExtensions } from "./index";

describe("resolveDefaultHarnessExtensions", () => {
  it("keeps the default cards whether storytelling is on or off", () => {
    for (const storytellingEnabled of [false, true]) {
      const tools = resolveDefaultHarnessExtensions({ storytellingEnabled }).map(
        (e) => e.toolName,
      );
      expect(tools).toEqual(DEFAULT_HARNESS_EXTENSIONS.map((e) => e.toolName));
    }
  });

  it("no longer offers the client-side create_story card", () => {
    const tools = DEFAULT_HARNESS_EXTENSIONS.map((e) => e.toolName);
    expect(tools).toContain("ask_user_question");
    expect(tools).toContain("show_dashlet");
    expect(tools).not.toContain("create_story");
  });
});

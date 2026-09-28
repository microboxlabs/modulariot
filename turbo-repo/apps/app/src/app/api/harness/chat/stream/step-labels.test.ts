import { describe, expect, it } from "vitest";

import { stepKeyOf, stepLabel } from "./step-labels";

describe("step labels", () => {
  it("matches connection tools on their primitive suffix", () => {
    expect(stepKeyOf("fleet_profile")).toBe("profile");
    expect(stepKeyOf("gps_list_tables")).toBe("list_tables");
    expect(stepKeyOf("web_search")).toBe("web_search");
    expect(stepKeyOf("acs_workflow")).toBe("workflow");
  });

  it("labels the artifact, source and web tools", () => {
    for (const tool of [
      "artifact",
      "source_search",
      "source_read",
      "source_list",
      "web_fetch",
    ]) {
      expect(stepKeyOf(tool)).toBe(tool);
    }
  });

  it("keeps the raw name for a tool it does not know", () => {
    expect(stepLabel("fs_read", ((k: string) => k) as never)).toBe("fs_read");
  });

  it("reads the label from the dictionary", () => {
    expect(stepLabel("acs_show", ((k: string) => `[${k}]`) as never)).toBe(
      "[harnessChat.stream.steps.show]"
    );
  });
});

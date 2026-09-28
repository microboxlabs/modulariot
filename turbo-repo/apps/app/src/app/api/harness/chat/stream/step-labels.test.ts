import { describe, expect, it } from "vitest";

import { stepKeyOf, stepLabel } from "./step-labels";

describe("step labels", () => {
  it("matches connection tools on their primitive suffix", () => {
    expect(stepKeyOf("fleet_profile")).toBe("profile");
    expect(stepKeyOf("gps_list_tables")).toBe("list_tables");
    expect(stepKeyOf("web_search")).toBe("web_search");
  });

  it("keeps the raw name for a tool it does not know", () => {
    expect(stepLabel("fs_read", (k) => k)).toBe("fs_read");
  });

  it("reads the label from the dictionary", () => {
    expect(stepLabel("acs_show", (k) => `[${k}]`)).toBe(
      "[harnessChat.stream.steps.show]"
    );
  });
});

import { describe, expect, it } from "vitest";
import { parseRulePresets } from "./rule-presets.types";

const preset = {
  key: "permission",
  name: "Permission",
  description: "Request consent",
  spec: {
    trigger: { event: "trip.milestone.confirmed" },
    groups: [{ id: "driver", entries: [{ contacts: "true" }] }],
    steps: [
      {
        after: 0,
        channel: "whatsapp",
        template: "permission",
        to: ["driver"],
        waitForReply: 0,
      },
    ],
  },
};

describe("rule presets API boundary", () => {
  it("validates the complete spec and supplies backend defaults", () => {
    const [result] = parseRulePresets([preset]);
    expect(result.spec.trigger.when).toBeNull();
    expect(result.spec.steps[0].onReply).toBe("stop");
    expect(result.spec.groups[0].entries[0].contacts).toBe("true");
  });
  it.each([
    {},
    null,
    [{ ...preset, spec: {} }],
    [{ ...preset, spec: { ...preset.spec, trigger: null } }],
  ])("rejects malformed JSON before the form can render it: %s", (payload) => {
    expect(() => parseRulePresets(payload)).toThrow();
  });
});

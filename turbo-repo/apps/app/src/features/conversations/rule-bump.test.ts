import { describe, expect, it } from "vitest";
import type { RuleSpec } from "./conversations-types";
import { nextRuleVersion, ruleBump } from "./rule-model";

const base: RuleSpec = {
  trigger: { event: "symptom.case.opened", when: "event.data.level >= 4" },
  audience: [{ role: "driver" }],
  steps: [
    {
      after: 0,
      channel: "whatsapp",
      template: "check",
      to: "audience",
      waitForReply: 5,
      onReply: "stop",
    },
    {
      after: 5,
      channel: "email",
      template: "tower",
      to: "audience",
      waitForReply: 0,
      onReply: "stop",
    },
  ],
};

const step = (spec: RuleSpec, i: number, patch: object): RuleSpec => ({
  ...spec,
  steps: spec.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
});

describe("ruleBump", () => {
  it("is MINOR for the first publish and null when nothing changed", () => {
    expect(ruleBump(base, null)).toBe("MINOR");
    expect(ruleBump(base, structuredClone(base))).toBeNull();
  });

  it("is PATCH when only the family changes, like the server", () => {
    expect(ruleBump({ ...base, family: "trips" }, base)).toBe("PATCH");
    expect(ruleBump({ ...base, family: null }, base)).toBeNull();
  });

  it("ignores property order and whitespace in the condition, like the server", () => {
    const reordered: RuleSpec = {
      ...base,
      trigger: { ...base.trigger, when: "  event.data.level   >= 4 " },
      steps: base.steps.map((s) =>
        Object.fromEntries(Object.entries(s).reverse())
      ) as RuleSpec["steps"],
    };
    expect(ruleBump(reordered, base)).toBeNull();
  });

  it("is MAJOR when the event changes", () => {
    const closed = {
      ...base,
      trigger: { ...base.trigger, event: "symptom.case.closed" },
    };
    expect(ruleBump(closed, base)).toBe("MAJOR");
  });

  it("is MINOR for the condition, recipients, steps and their routing", () => {
    const level3 = {
      ...base,
      trigger: { ...base.trigger, when: "event.data.level >= 3" },
    };
    expect(ruleBump(level3, base)).toBe("MINOR");
    expect(
      ruleBump({ ...base, audience: [{ role: "tower_lead" }] }, base)
    ).toBe("MINOR");
    expect(ruleBump({ ...base, steps: base.steps.slice(0, 1) }, base)).toBe(
      "MINOR"
    );
    expect(ruleBump(step(base, 1, { channel: "whatsapp" }), base)).toBe(
      "MINOR"
    );
    const slack = step(base, 1, { channel: "slack", connection: "conn-1" });
    expect(ruleBump(step(slack, 1, { connection: "conn-2" }), slack)).toBe(
      "MINOR"
    );
  });

  it("is MINOR when steps only change places", () => {
    const sameChannel = step(base, 1, { channel: "whatsapp" });
    const swapped = { ...sameChannel, steps: [...sameChannel.steps].reverse() };
    expect(ruleBump(swapped, sameChannel)).toBe("MINOR");
  });

  it("is PATCH for minutes, template and reply", () => {
    expect(ruleBump(step(base, 1, { after: 10 }), base)).toBe("PATCH");
    expect(ruleBump(step(base, 0, { template: "check-v2" }), base)).toBe(
      "PATCH"
    );
    expect(ruleBump(step(base, 0, { onReply: "continue" }), base)).toBe(
      "PATCH"
    );
  });
});

describe("nextRuleVersion", () => {
  it("starts at 0.1.0 and bumps like symptoms", () => {
    expect(nextRuleVersion(null, "MINOR")).toBe("0.1.0");
    expect(nextRuleVersion("0.3.2", "MAJOR")).toBe("1.0.0");
    expect(nextRuleVersion("0.3.2", "MINOR")).toBe("0.4.0");
    expect(nextRuleVersion("0.3.2", "PATCH")).toBe("0.3.3");
  });
});

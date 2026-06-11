import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { FooterLine } from "../../chrome/FooterLine.js";
import type { UsageTotals } from "../../session/types.js";

function usage(partial: Partial<UsageTotals> = {}): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    lastAgent: null,
    lastCostUsd: null,
    ...partial,
  };
}

function props(overrides: Partial<Parameters<typeof FooterLine>[0]> = {}) {
  return {
    turns: 3,
    approxTokens: 1234,
    contextPercent: 1,
    baseUrl: "http://localhost:8000",
    profileName: null,
    pendingApprovals: 0,
    ...overrides,
  };
}

describe("<FooterLine />", () => {
  it("shows turns, context estimate, and base url", () => {
    const { lastFrame } = render(<FooterLine {...props()} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("turns 3");
    expect(frame).toContain("ctx≈1234tok (1%)");
    expect(frame).toContain("http://localhost:8000");
  });

  it("includes the profile name when present", () => {
    const { lastFrame } = render(
      <FooterLine {...props({ profileName: "staging" })} />,
    );
    expect(lastFrame() ?? "").toContain("profile staging");
  });

  it("shows a usage segment when usageTotals has any tokens", () => {
    const { lastFrame } = render(
      <FooterLine
        {...props({
          usageTotals: usage({
            inputTokens: 1234,
            outputTokens: 56,
            costUsd: 0.0123,
            lastAgent: "synthesizer",
            lastCostUsd: 0.0123,
          }),
        })}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("1234→56");
    expect(frame).toContain("$0.0123");
  });

  it("hides the usage segment when there are no tokens yet", () => {
    const { lastFrame } = render(
      <FooterLine {...props({ usageTotals: usage() })} />,
    );
    expect(lastFrame() ?? "").not.toContain("→");
  });

  it("shows a pending-approvals segment when there is one", () => {
    const { lastFrame } = render(
      <FooterLine {...props({ pendingApprovals: 2 })} />,
    );
    expect(lastFrame() ?? "").toContain("approvals 2");
  });

  it("hides the approvals segment when there are none", () => {
    const { lastFrame } = render(<FooterLine {...props()} />);
    expect(lastFrame() ?? "").not.toContain("approvals");
  });
});

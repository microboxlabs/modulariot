import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { InputFrame } from "../../chrome/InputFrame.js";

describe("<InputFrame />", () => {
  it("draws a rounded frame around its content", () => {
    const { lastFrame } = render(
      <InputFrame label="miot · auto">
        <Text>hello</Text>
      </InputFrame>,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("╭");
    expect(frame).toContain("╰");
    expect(frame).toContain("╯");
    expect(frame).toContain("hello");
  });

  it("embeds the label in the bottom border line", () => {
    const { lastFrame } = render(
      <InputFrame label="miot · auto">
        <Text>hi</Text>
      </InputFrame>,
    );
    const lines = (lastFrame() ?? "").split("\n");
    const bottom = lines[lines.length - 1] ?? "";
    expect(bottom).toContain("miot · auto");
    expect(bottom.startsWith("╰")).toBe(true);
    expect(bottom.endsWith("╯")).toBe(true);
  });

  it("keeps every line within the terminal width", () => {
    const { lastFrame } = render(
      <InputFrame label="miot · auto">
        <Text>hi</Text>
      </InputFrame>,
    );
    const lines = (lastFrame() ?? "").split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(100);
    }
  });

  it("shows a warn marker when labelWarn is set", () => {
    const { lastFrame } = render(
      <InputFrame label="miot · agentic" labelWarn>
        <Text>hi</Text>
      </InputFrame>,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("⚠");
    expect(frame).toContain("miot · agentic");
  });
});

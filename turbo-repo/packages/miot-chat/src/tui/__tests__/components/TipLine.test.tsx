import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { TIPS, TipLine } from "../../chrome/TipLine.js";

describe("<TipLine />", () => {
  it("renders the tip at the given index", () => {
    const { lastFrame } = render(<TipLine tipIndex={1} />);
    expect(lastFrame() ?? "").toContain(TIPS[1]);
  });

  it("wraps around when the index exceeds the tip count", () => {
    const { lastFrame } = render(<TipLine tipIndex={TIPS.length} />);
    expect(lastFrame() ?? "").toContain(TIPS[0]);
  });
});

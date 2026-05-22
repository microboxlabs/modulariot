import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";

describe("ink smoke", () => {
  it("renders a Text node", () => {
    const { lastFrame } = render(<Text>hello-tui</Text>);
    expect(lastFrame()).toContain("hello-tui");
  });
});

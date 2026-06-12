import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { WelcomeCard } from "../../chrome/WelcomeCard.js";

describe("<WelcomeCard />", () => {
  it("shows the title and version", () => {
    const { lastFrame } = render(<WelcomeCard version="0.1.0" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("miot chat");
    expect(frame).toContain("v0.1.0");
  });

  it("lists the menu actions with their shortcuts", () => {
    const { lastFrame } = render(<WelcomeCard version="0.1.0" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Resume session");
    expect(frame).toContain("ctrl+r");
    expect(frame).toContain("Switch theme");
    expect(frame).toContain("ctrl+t");
    expect(frame).toContain("Help");
    expect(frame).toContain("ctrl+g");
    expect(frame).toContain("Quit");
    expect(frame).toContain("ctrl+q");
  });

  it("renders the owl logo", () => {
    const { lastFrame } = render(<WelcomeCard version="0.1.0" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("◉ ◉");
    expect(frame).toContain("▼");
  });

  it("renders inside a bordered card", () => {
    const { lastFrame } = render(<WelcomeCard version="0.1.0" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("╭");
    expect(frame).toContain("╰");
  });
});

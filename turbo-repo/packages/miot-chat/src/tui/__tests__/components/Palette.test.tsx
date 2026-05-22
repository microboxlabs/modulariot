import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Palette } from "../../slash/Palette.js";
import {
  SlashRegistry,
  type SlashCommand,
  type SlashResult,
} from "../../slash/registry.js";

function cmd(name: string, summary: string): SlashCommand {
  return {
    name,
    summary,
    usage: `/${name}`,
    handle: (): SlashResult => ({}),
  };
}

function seed(): SlashRegistry {
  return new SlashRegistry()
    .register(cmd("context", "Show session context"))
    .register(cmd("clear", "Clear the transcript"))
    .register(cmd("mode", "Change run mode"))
    .register(cmd("whoami", "Print user identity"))
    .register(cmd("tenant", "Change tenant"));
}

describe("<Palette />", () => {
  it("renders nothing when no commands match", () => {
    const { lastFrame } = render(
      <Palette registry={seed()} query="zzzz" selectedIndex={0} />,
    );
    expect((lastFrame() ?? "").trim()).toBe("");
  });

  it("renders the full list when the query is empty", () => {
    const { lastFrame } = render(
      <Palette registry={seed()} query="" selectedIndex={0} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("/context");
    expect(frame).toContain("/clear");
    expect(frame).toContain("/mode");
    expect(frame).toContain("/whoami");
    expect(frame).toContain("/tenant");
  });

  it("filters by substring, name matches first", () => {
    const { lastFrame } = render(
      <Palette registry={seed()} query="con" selectedIndex={0} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("/context");
    expect(frame).not.toContain("/clear");
    expect(frame).not.toContain("/mode");
  });

  it("falls back to summary matches", () => {
    const { lastFrame } = render(
      <Palette
        registry={seed()}
        query="transcript"
        selectedIndex={0}
      />,
    );
    expect(lastFrame() ?? "").toContain("/clear");
  });

  it("clamps selectedIndex into the visible range", () => {
    // selectedIndex too high → renders without crashing, falls back to last
    // visible item. We assert it doesn't error and frame still contains the
    // matches.
    const { lastFrame } = render(
      <Palette registry={seed()} query="" selectedIndex={42} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("/clear");
  });

  it("truncates to maxRows and shows the overflow hint", () => {
    const reg = seed()
      .register(cmd("save", "Save transcript"))
      .register(cmd("reset", "Reset conversation"))
      .register(cmd("exit", "Quit"))
      .register(cmd("help", "Show commands"));
    const { lastFrame } = render(
      <Palette registry={reg} query="" selectedIndex={0} maxRows={3} />,
    );
    const frame = lastFrame() ?? "";
    // 9 commands total, 3 visible → 6 more.
    expect(frame).toContain("more");
  });
});

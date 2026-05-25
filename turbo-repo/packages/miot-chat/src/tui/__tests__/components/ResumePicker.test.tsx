import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ResumePicker } from "../../modals/ResumePicker.js";
import { resumeCommand } from "../../slash/handlers/resume.js";
import type { SessionSummary } from "../../persistence/store.js";

function s(
  id: string,
  lastPrompt: string,
  lastTurn = 1,
  mtime = 1735689600000,
): SessionSummary {
  return { id, lastPrompt, lastTurn, mtime };
}

describe("<ResumePicker /> — empty", () => {
  it("shows a (no saved sessions) hint", () => {
    const { lastFrame } = render(
      <ResumePicker
        summaries={[]}
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(lastFrame() ?? "").toContain("no saved sessions");
  });

  it("Esc still triggers onCancel even when empty", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ResumePicker
        summaries={[]}
        onSelect={() => undefined}
        onCancel={onCancel}
      />,
    );
    stdin.write("\x1b");
    await new Promise((r) => setTimeout(r, 50));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("<ResumePicker /> — list", () => {
  function seed(): SessionSummary[] {
    return [
      s("aaaaaaaa-conv-1", "first prompt", 1),
      s("bbbbbbbb-conv-2", "second prompt"),
      s("cccccccc-conv-3", "third prompt"),
    ];
  }

  it("renders one row per summary with short id + prompt", () => {
    const { lastFrame } = render(
      <ResumePicker
        summaries={seed()}
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("aaaaaaaa");
    expect(frame).toContain("first prompt");
    expect(frame).toContain("bbbbbbbb");
    expect(frame).toContain("third prompt");
  });

  it("Enter selects the first entry by default", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ResumePicker
        summaries={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("aaaaaaaa-conv-1");
  });

  it("Arrow Down + Enter selects the second entry", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ResumePicker
        summaries={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    stdin.write("\x1b[B"); // down arrow
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("bbbbbbbb-conv-2");
  });

  it("Arrow Down clamps at the last entry", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ResumePicker
        summaries={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    // Press down many times — should clamp at index 2 (cccccccc-conv-3).
    for (let i = 0; i < 10; i += 1) {
      stdin.write("\x1b[B");
      await new Promise((r) => setTimeout(r, 5));
    }
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("cccccccc-conv-3");
  });

  it("Arrow Up clamps at index 0", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ResumePicker
        summaries={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    stdin.write("\x1b[A");
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("aaaaaaaa-conv-1");
  });
});

describe("/resume handler", () => {
  it("returns a modal:resume directive", async () => {
    const r = await resumeCommand.handle([], {});
    expect(r.modal).toEqual({ kind: "resume" });
  });
});

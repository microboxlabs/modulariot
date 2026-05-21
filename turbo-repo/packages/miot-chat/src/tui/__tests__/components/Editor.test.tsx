import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { Editor } from "../../input/Editor.js";
import { mapKey, type KeyState } from "../../input/keymap.js";
import { appendHistory, initialHistory } from "../../input/history.js";

function key(partial: Partial<KeyState> = {}): KeyState {
  return { ...partial };
}

describe("mapKey", () => {
  it("plain printable char becomes INSERT", () => {
    expect(mapKey("a", key())).toEqual({ kind: "INSERT", text: "a" });
  });

  it("Enter alone is SUBMIT", () => {
    expect(mapKey("", key({ return: true }))).toEqual({ kind: "SUBMIT" });
  });

  it("Alt-Enter is NEWLINE", () => {
    expect(mapKey("", key({ return: true, meta: true }))).toEqual({
      kind: "NEWLINE",
    });
  });

  it("Backspace and Delete map to BACKSPACE / DELETE_FORWARD", () => {
    expect(mapKey("", key({ backspace: true }))).toEqual({ kind: "BACKSPACE" });
    expect(mapKey("", key({ delete: true }))).toEqual({
      kind: "DELETE_FORWARD",
    });
  });

  it("Arrow keys map to MOVE_*", () => {
    expect(mapKey("", key({ leftArrow: true }))).toEqual({ kind: "MOVE_LEFT" });
    expect(mapKey("", key({ rightArrow: true }))).toEqual({
      kind: "MOVE_RIGHT",
    });
    expect(mapKey("", key({ upArrow: true }))).toEqual({ kind: "MOVE_UP" });
    expect(mapKey("", key({ downArrow: true }))).toEqual({ kind: "MOVE_DOWN" });
  });

  it("Ctrl+Left and Ctrl+Right are word-jumps", () => {
    expect(mapKey("", key({ leftArrow: true, ctrl: true }))).toEqual({
      kind: "MOVE_WORD_LEFT",
    });
    expect(mapKey("", key({ rightArrow: true, ctrl: true }))).toEqual({
      kind: "MOVE_WORD_RIGHT",
    });
  });

  it("Ctrl+A / Ctrl+E / Ctrl+K map to HOME / END / KILL_LINE", () => {
    expect(mapKey("a", key({ ctrl: true }))).toEqual({ kind: "MOVE_HOME" });
    expect(mapKey("e", key({ ctrl: true }))).toEqual({ kind: "MOVE_END" });
    expect(mapKey("k", key({ ctrl: true }))).toEqual({ kind: "KILL_LINE" });
  });

  it("Ctrl+C is CANCEL", () => {
    expect(mapKey("c", key({ ctrl: true }))).toEqual({ kind: "CANCEL" });
  });

  it("Escape / Tab / PageUp / PageDown are ignored (null)", () => {
    expect(mapKey("", key({ escape: true }))).toBeNull();
    expect(mapKey("", key({ tab: true }))).toBeNull();
    expect(mapKey("", key({ pageUp: true }))).toBeNull();
    expect(mapKey("", key({ pageDown: true }))).toBeNull();
  });

  it("printable input with ctrl is not inserted", () => {
    // Ctrl+B with no special mapping → null (not an INSERT)
    expect(mapKey("b", key({ ctrl: true }))).toBeNull();
  });
});

describe("<Editor /> component", () => {
  it("renders the prompt prefix with the cursor visible on an empty line", () => {
    const { lastFrame } = render(<Editor onSubmit={() => undefined} />);
    const frame = lastFrame() ?? "";
    expect(frame.startsWith("›")).toBe(true);
  });

  it("submits the buffer text on Enter and clears the input", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<Editor onSubmit={onSubmit} />);
    stdin.write("hi");
    await Promise.resolve();
    expect(lastFrame() ?? "").toContain("hi");
    stdin.write("\r");
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("hi");
    // Buffer is cleared after submit.
    const after = lastFrame() ?? "";
    expect(after.replace(/\s|›/g, "")).toBe("");
  });

  it("backspace removes the last char", async () => {
    const { stdin, lastFrame } = render(<Editor onSubmit={() => undefined} />);
    stdin.write("ab");
    stdin.write("\x7f");
    await Promise.resolve();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("a");
    expect(frame).not.toMatch(/›\s+ab/);
  });

  it("submitting whitespace-only input does not fire onSubmit", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Editor onSubmit={onSubmit} />);
    stdin.write("   \r");
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl+C invokes onCancel", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <Editor onSubmit={() => undefined} onCancel={onCancel} />,
    );
    stdin.write("\x03");
    await Promise.resolve();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("arrow-up at the start recalls the most recent history entry", async () => {
    const seeded = appendHistory(initialHistory(), "echo hello");
    const { stdin, lastFrame } = render(
      <Editor onSubmit={() => undefined} initialHistory={seeded} />,
    );
    // Up arrow: ESC [ A
    stdin.write("\x1b[A");
    await Promise.resolve();
    expect(lastFrame() ?? "").toContain("echo hello");
  });
});

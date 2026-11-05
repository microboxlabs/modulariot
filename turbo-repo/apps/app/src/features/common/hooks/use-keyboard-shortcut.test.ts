import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcut } from "./use-keyboard-shortcut";

const tecla = (init: KeyboardEventInit) =>
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", init));
  });

describe("useKeyboardShortcut", () => {
  it("shows the modifier as held and fires on the chord", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcut({ key: "j", onTrigger })
    );
    tecla({ key: "Meta", metaKey: true });
    expect(result.current.modifierHeld).toBe(true);
    tecla({ key: "j", metaKey: true });
    expect(onTrigger).toHaveBeenCalledOnce();
  });

  it("tells ⌘Z and ⌘⇧Z apart with `shift`", () => {
    const deshacer = vi.fn();
    const rehacer = vi.fn();
    renderHook(() => {
      useKeyboardShortcut({ key: "z", shift: false, onTrigger: deshacer });
      useKeyboardShortcut({ key: "z", shift: true, onTrigger: rehacer });
    });
    tecla({ key: "z", metaKey: true });
    tecla({ key: "Z", metaKey: true, shiftKey: true });
    expect(deshacer).toHaveBeenCalledOnce();
    expect(rehacer).toHaveBeenCalledOnce();
  });

  it("skips events the caller ignores", () => {
    const onTrigger = vi.fn();
    renderHook(() =>
      useKeyboardShortcut({ key: "z", onTrigger, ignore: () => true })
    );
    tecla({ key: "z", metaKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });
});

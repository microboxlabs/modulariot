"use client";

import { useEffect, useRef, useState } from "react";

export type UseKeyboardShortcutOptions = {
  /** The key to listen for, matched case-insensitively (e.g. "c", "k"). */
  key: string;
  /** Require Cmd (Mac) or Ctrl (Windows/Linux) held down. @default true */
  withModifier?: boolean;
  /** Called when the shortcut fires. */
  onTrigger: () => void;
  /** Set to false to stop listening without unmounting. @default true */
  enabled?: boolean;
};

/**
 * Global keyboard shortcut listener, exposing the state needed to render a
 * hint badge: whether the modifier is currently held, and a brief pulse
 * right after the shortcut fires.
 */
export function useKeyboardShortcut({
  key,
  withModifier = true,
  onTrigger,
  enabled = true,
}: UseKeyboardShortcutOptions) {
  const [modifierHeld, setModifierHeld] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (withModifier && (e.metaKey || e.ctrlKey)) setModifierHeld(true);

      const modifierOk = !withModifier || e.metaKey || e.ctrlKey;
      if (modifierOk && e.key.toLowerCase() === key.toLowerCase()) {
        onTrigger();
        clearTimeout(pulseTimeoutRef.current);
        setJustTriggered(true);
        pulseTimeoutRef.current = setTimeout(() => setJustTriggered(false), 150);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (withModifier && !e.metaKey && !e.ctrlKey) setModifierHeld(false);
    };
    // Cmd+Tab away (or any focus loss) can eat the keyup — reset on blur too.
    const onBlur = () => setModifierHeld(false);

    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("keyup", onKeyUp);
    globalThis.addEventListener("blur", onBlur);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup", onKeyUp);
      globalThis.removeEventListener("blur", onBlur);
      clearTimeout(pulseTimeoutRef.current);
    };
  }, [key, withModifier, onTrigger, enabled]);

  return { modifierHeld, justTriggered };
}

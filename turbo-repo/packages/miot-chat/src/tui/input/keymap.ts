import type { EditorAction } from "./reducer.js";

export type KeymapAction =
  | EditorAction
  | { kind: "SUBMIT" }
  | { kind: "CANCEL" }
  | { kind: "COMPLETE" };

export interface KeyState {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
}

export function mapKey(
  input: string,
  key: KeyState,
): KeymapAction | null {
  if (key.ctrl && input === "c") return { kind: "CANCEL" };
  if (key.return && key.meta) return { kind: "NEWLINE" };
  if (key.return) return { kind: "SUBMIT" };
  if (key.backspace) return { kind: "BACKSPACE" };
  if (key.delete) return { kind: "DELETE_FORWARD" };
  if (key.leftArrow && key.ctrl) return { kind: "MOVE_WORD_LEFT" };
  if (key.rightArrow && key.ctrl) return { kind: "MOVE_WORD_RIGHT" };
  if (key.leftArrow) return { kind: "MOVE_LEFT" };
  if (key.rightArrow) return { kind: "MOVE_RIGHT" };
  if (key.upArrow) return { kind: "MOVE_UP" };
  if (key.downArrow) return { kind: "MOVE_DOWN" };
  if (key.ctrl && input === "a") return { kind: "MOVE_HOME" };
  if (key.ctrl && input === "e") return { kind: "MOVE_END" };
  if (key.ctrl && input === "k") return { kind: "KILL_LINE" };
  if (key.tab) return { kind: "COMPLETE" };
  if (key.escape) return null;
  if (key.pageUp || key.pageDown) return null;
  if (input.length > 0 && !key.ctrl && !key.meta) {
    return { kind: "INSERT", text: input };
  }
  return null;
}

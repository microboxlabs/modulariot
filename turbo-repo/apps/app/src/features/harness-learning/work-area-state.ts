import {
  workItemKey,
  type WorkItem,
} from "@/features/harness-chat/context/work-area-context";

/** The items opened in the working area, most recent last, and the one
 * shown. Reopening an item moves it to the end instead of repeating it. */
export type WorkAreaState = {
  items: WorkItem[];
  index: number;
  open: boolean;
};

export const MAX_RECENT_ITEMS = 20;

export const INITIAL_WORK_AREA: WorkAreaState = {
  items: [],
  index: -1,
  open: false,
};

export type WorkAreaAction =
  | { type: "open"; item: WorkItem }
  | { type: "back" }
  | { type: "forward" }
  | { type: "go"; index: number }
  | { type: "toggle" }
  | { type: "close" };

export function workAreaReducer(
  state: WorkAreaState,
  action: WorkAreaAction
): WorkAreaState {
  switch (action.type) {
    case "open": {
      const key = workItemKey(action.item);
      const items = [
        ...state.items.filter((i) => workItemKey(i) !== key),
        action.item,
      ].slice(-MAX_RECENT_ITEMS);
      return { items, index: items.length - 1, open: true };
    }
    case "back":
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case "forward":
      return state.index < state.items.length - 1
        ? { ...state, index: state.index + 1 }
        : state;
    case "go":
      return action.index >= 0 && action.index < state.items.length
        ? { ...state, index: action.index, open: true }
        : state;
    case "toggle":
      return { ...state, open: !state.open };
    case "close":
      return { ...state, open: false };
  }
}

export function currentItem(state: WorkAreaState): WorkItem | null {
  return state.items[state.index] ?? null;
}

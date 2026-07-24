import { describe, expect, it, vi } from "vitest";
import {
  createWindowHistoryUrlStateAdapter,
  type WindowLike,
} from "./url-state";

function fakeWindow(initialSearch = "", pathname = "/dash"): WindowLike & {
  popstateListeners: Set<() => void>;
} {
  const popstateListeners = new Set<() => void>();
  const win = {
    location: { search: initialSearch, pathname },
    history: {
      pushState: vi.fn((_d: unknown, _u: string, url?: string) => {
        applyUrl(url);
      }),
      replaceState: vi.fn((_d: unknown, _u: string, url?: string) => {
        applyUrl(url);
      }),
    },
    addEventListener: (_t: "popstate", l: () => void) => popstateListeners.add(l),
    removeEventListener: (_t: "popstate", l: () => void) =>
      popstateListeners.delete(l),
    popstateListeners,
  };
  function applyUrl(url?: string) {
    if (!url) return;
    const [path, qs = ""] = url.split("?");
    win.location.pathname = path ?? pathname;
    win.location.search = qs ? `?${qs}` : "";
  }
  return win;
}

describe("createWindowHistoryUrlStateAdapter", () => {
  it("reads params and pathname", () => {
    const adapter = createWindowHistoryUrlStateAdapter(fakeWindow("?a=1&b=2"));
    expect(adapter.get("a")).toBe("1");
    expect(adapter.get("missing")).toBeNull();
    expect(adapter.getAll()).toEqual({ a: "1", b: "2" });
    expect(adapter.pathname()).toBe("/dash");
  });

  it("sets, merges and deletes params via pushState", () => {
    const win = fakeWindow("?keep=1&drop=2");
    const adapter = createWindowHistoryUrlStateAdapter(win);
    adapter.set({ added: "3", drop: null });
    expect(win.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/dash?keep=1&added=3"
    );
    expect(adapter.getAll()).toEqual({ keep: "1", added: "3" });
  });

  it("uses replaceState when replace: true", () => {
    const win = fakeWindow();
    const adapter = createWindowHistoryUrlStateAdapter(win);
    adapter.set({ q: "x" }, { replace: true });
    expect(win.history.replaceState).toHaveBeenCalled();
    expect(win.history.pushState).not.toHaveBeenCalled();
  });

  it("emits to subscribers on set and unsubscribes cleanly", () => {
    const win = fakeWindow();
    const adapter = createWindowHistoryUrlStateAdapter(win);
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    adapter.set({ a: "1" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(win.popstateListeners.size).toBe(1);
    unsubscribe();
    expect(win.popstateListeners.size).toBe(0);
    adapter.set({ a: "2" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("drops the query string entirely when the last param is removed", () => {
    const win = fakeWindow("?only=1");
    const adapter = createWindowHistoryUrlStateAdapter(win);
    adapter.set({ only: null });
    expect(win.history.pushState).toHaveBeenCalledWith(null, "", "/dash");
  });

  it("throws a wiring error when no window is available", () => {
    const adapter = createWindowHistoryUrlStateAdapter();
    const hasDomWindow = typeof (globalThis as { window?: unknown }).window !== "undefined";
    if (!hasDomWindow) {
      expect(() => adapter.get("a")).toThrow(/no window available/);
    }
  });
});

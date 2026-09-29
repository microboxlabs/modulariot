import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmNavigation,
  useUnsavedNavigation,
} from "./use-unsaved-navigation";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("unsaved navigation", () => {
  it("blocks application links before their navigation handler runs", () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    renderHook(() => useUnsavedNavigation(true, "Discard draft?"));
    const anchor = document.createElement("a");
    anchor.href = "/another-page";
    const navigate = vi.fn((event: Event) => event.preventDefault());
    anchor.addEventListener("click", navigate);
    document.body.append(anchor);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    anchor.remove();
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("consults the guard before switching organization or sending a mutation", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ availableOrgs: [] }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => {
      useUnsavedNavigation(true, "Discard draft?");
      return useOrgScopes();
    });
    await result.current.switchOrg("another-org");
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false
    );
  });

  it("allows confirmed navigation and removes the guard after saving or unmount", () => {
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const { rerender, unmount } = renderHook(
      ({ dirty }) => useUnsavedNavigation(dirty, "Discard draft?"),
      { initialProps: { dirty: true } }
    );
    expect(confirmNavigation()).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    rerender({ dirty: false });
    expect(confirmNavigation()).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    unmount();
    expect(confirmNavigation()).toBe(true);
  });
});

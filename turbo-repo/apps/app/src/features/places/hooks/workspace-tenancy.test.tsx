import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORM_VACIO } from "../places.types";
import { lugarDesdeForm } from "../data/local-store";
import { placesStorageKey } from "../data/storage-key";

const state = vi.hoisted(() => ({
  org: "demo-org-a" as string | null,
  user: "demo-user-a" as string | null,
  swr: vi.fn(),
}));
vi.mock("swr", () => ({ default: state.swr }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: state.user ? { user: { id: state.user } } : null,
  }),
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({ activeOrg: state.org ? { slug: state.org } : null }),
  })
);
vi.mock("@/features/auth/hooks/use-carrier-mode", () => ({
  useCarrierMode: () => ({ carrierMode: true }),
}));
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({}),
}));
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
import { usePlacesWorkspace } from "./use-places-workspace";

beforeEach(() => {
  globalThis.localStorage.clear();
  state.org = "demo-org-a";
  state.user = "demo-user-a";
  state.swr.mockReset().mockReturnValue({ data: undefined, mutate: vi.fn() });
});

describe("Places workspace identity", () => {
  it("does not display another organization or account's offline drafts", () => {
    const scope = JSON.stringify([state.user, state.org]);
    const key = placesStorageKey("miot.settings.places.local.v1", scope)!;
    const draft = lugarDesdeForm(
      { ...FORM_VACIO, name: "Demo private draft", lat: 1, lon: 1 },
      [],
      "local-demo"
    );
    globalThis.localStorage.setItem(
      key,
      JSON.stringify({ lugares: [draft], trayectos: [] })
    );
    const { result, rerender } = renderHook(() =>
      usePlacesWorkspace({ current: null })
    );
    expect(result.current.todosLugares.map((place) => place.name)).toEqual([
      "Demo private draft",
    ]);
    state.org = "demo-org-b";
    rerender();
    expect(result.current.todosLugares).toEqual([]);
    state.org = "demo-org-a";
    state.user = "demo-user-b";
    rerender();
    expect(result.current.todosLugares).toEqual([]);
  });

  it("waits for a resolved identity before starting reads", () => {
    state.org = null;
    renderHook(() => usePlacesWorkspace({ current: null }));
    expect(state.swr.mock.calls.every(([key]) => key === null)).toBe(true);
  });

  it("keys every remote read by identity and fetches its URL", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetch);
    renderHook(() => usePlacesWorkspace({ current: null }));
    const reads = state.swr.mock.calls.filter(([key]) => key !== null);
    expect(reads.length).toBeGreaterThanOrEqual(5);
    for (const [key, loader] of reads) {
      expect(key[1]).toBe(JSON.stringify([state.user, state.org]));
      await loader(key);
    }
    expect(
      fetch.mock.calls.every(
        ([url]) => typeof url === "string" && url.startsWith("/app/api/")
      )
    ).toBe(true);
  });
});

describe("Places browser-only creation", () => {
  it("stores new places locally and never writes to StreamHub or PT4", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(() =>
      usePlacesWorkspace({ current: null })
    );
    act(() => {
      result.current.setModo("lugar");
      result.current.setForm({
        ...FORM_VACIO,
        name: "Demo draft",
        lat: 1,
        lon: 1,
      });
    });
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.todosLugares.map((place) => place.name)).toEqual([
      "Demo draft",
    ]);
    state.org = "demo-org-b";
    rerender();
    expect(result.current.todosLugares).toEqual([]);
  });

  it("does not copy the open form into a newly selected organization's draft", () => {
    const { result, rerender } = renderHook(() =>
      usePlacesWorkspace({ current: null })
    );
    act(() => {
      result.current.setModo("lugar");
      result.current.setForm({
        ...FORM_VACIO,
        name: "Demo private draft",
        lat: 1,
        lon: 1,
      });
    });
    state.org = "demo-org-b";
    rerender();
    expect(result.current.form.name).toBe("");
    expect(result.current.modo).toBe("ver");
    const key = placesStorageKey(
      "miot.places.draft.v1.geografico",
      JSON.stringify([state.user, state.org])
    )!;
    expect(localStorage.getItem(key)).toBeNull();
    state.org = "demo-org-a";
    rerender();
    vi.useFakeTimers();
    act(() => { expect(result.current.restaurarBorrador()).toBe(true); });
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

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
import { nuevoInner } from "../geofences/inner-geofences";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
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
        ([url]) =>
          typeof url === "string" && url.startsWith("/app/api/atc/rpc/")
      )
    ).toBe(true);
  });
});

describe("Places partial save failures", () => {
  it.each(["http", "rejected", "validity"])(
    "keeps the saved parent and pending edits after %s failure",
    async (failure) => {
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, place_id: "demo-parent" }),
        })
        .mockResolvedValue({
          ok: failure === "rejected",
          json: async () => ({ ok: false, error: "demo failure" }),
        });
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(() =>
        usePlacesWorkspace({ current: null })
      );
      act(() => {
        result.current.setModo("lugar");
        result.current.setForm({
          ...FORM_VACIO,
          name: "Demo parent",
          lat: 1,
          lon: 1,
          active_from: failure === "validity" ? "2026-11-01" : "",
          inners:
            failure === "validity"
              ? []
              : [
                  {
                    ...nuevoInner(),
                    name: "Demo inner",
                    lat: 1,
                    lon: 1,
                  },
                ],
        });
      });
      await act(async () => {
        await result.current.guardarLugar();
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
      expect(result.current.form.place_id).toBe("demo-parent");
      expect(result.current.modo).toBe("lugar");
      expect(result.current.guardando).toBe(false);
    }
  );
});

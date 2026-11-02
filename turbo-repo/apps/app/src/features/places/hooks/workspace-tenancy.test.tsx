import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORM_VACIO, TRAY_VACIO, type LatLon } from "../places.types";
import { lugarDesdeForm } from "../data/local-store";
import { placesStorageKey } from "../data/storage-key";

const state = vi.hoisted(() => ({
  org: "demo-org-a" as string | null,
  user: "demo-user-a" as string | null,
  swr: vi.fn(),
  token: "",
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
  useRuntimeConfig: () => ({ MAPBOX_API_KEY: state.token }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
import type { MapMouseEvent } from "react-map-gl";
import { recorridoDesdePts } from "../routes/recorrido";
import { guardarBorrador } from "../data/draft-store";
import { usePlacesEnMapa } from "./use-places-en-mapa";
vi.mock("../map/place-name-layer", () => ({ capasNombresGeocercas: () => [] }));
import { usePlacesWorkspace } from "./use-places-workspace";

beforeEach(() => {
  globalThis.localStorage.clear();
  state.org = "demo-org-a";
  state.user = "demo-user-a";
  state.token = "";
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
    act(() => {
      expect(result.current.restaurarBorrador()).toBe(true);
    });
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

it("restores the selected organization's own draft after clearing the old editor", () => {
  vi.useFakeTimers();
  for (const org of ["demo-org-a", "demo-org-b"]) {
    guardarBorrador("geografico", JSON.stringify([state.user, org]), {
      tipo: "lugar",
      form: { ...FORM_VACIO, name: org, lat: 1, lon: 1 },
      paso: "geocerca",
      original: null,
      inicial: null,
    });
  }
  const { result, rerender, unmount } = renderHook(() =>
    usePlacesEnMapa(
      { current: null },
      { editando: true, mapStyle: "streets", zoom: 2 }
    )
  );
  expect(result.current.ws.form.name).toBe("demo-org-a");
  state.org = "demo-org-b";
  rerender();
  expect(result.current.ws.form.name).toBe("demo-org-b");
  unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("invalidates in-flight Directions when switching organization", async () => {
  state.token = "demo-token";
  let finish!: (value: unknown) => void;
  const fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  vi.stubGlobal("fetch", fetch);
  const points: LatLon[] = [
    [1, 1],
    [2, 2],
  ];
  const { result, rerender } = renderHook(() =>
    usePlacesWorkspace({ current: null })
  );
  act(() => {
    result.current.setModo("trayecto");
    result.current.setTray({
      ...TRAY_VACIO,
      name: "Demo old route",
      recorrido: recorridoDesdePts(points),
    });
  });
  act(() => result.current.confirmarTrayecto());
  expect(result.current.guardando).toBe(true);
  state.org = "demo-org-b";
  rerender();
  expect(result.current.guardando).toBe(false);
  act(() => {
    result.current.setModo("trayecto");
    result.current.setTray({ ...TRAY_VACIO, name: "Demo new route" });
  });
  await act(async () => {
    finish({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: {
              coordinates: [
                [10, 10],
                [11, 11],
              ],
            },
            legs: [{ steps: [{ name: "Demo old street" }] }],
          },
        ],
      }),
    });
  });
  expect(result.current.trayPathAjustado).toBeNull();
  expect(result.current.tray.vias).toEqual([]);
  expect(result.current.tray.name).toBe("Demo new route");
});

it("clears the previous organization's place context menu and hover", () => {
  const { result, rerender } = renderHook(() =>
    usePlacesWorkspace({ current: null })
  );
  const place = lugarDesdeForm(
    { ...FORM_VACIO, name: "Demo old place", lat: 1, lon: 1 },
    [],
    "local-demo-context"
  );
  act(() => {
    result.current.local.saveLugar(place);
  });
  const item = {
    id: place.place_id,
    name: place.name,
    color: "#000000",
    icon: "",
    ancla: [1, 1] as LatLon,
    lugar: place,
  };
  act(() => {
    result.current.onHoverNombre(item);
    result.current.onHoverBadge({ item, miembros: [item] }, { x: 1, y: 1 });
    result.current.onMapContextMenu({
      originalEvent: { preventDefault: vi.fn() },
      point: { x: 1, y: 1 },
      lngLat: { lat: 1, lng: 1 },
    } as unknown as MapMouseEvent);
  });
  expect(result.current.menuLugar?.lugar.name).toBe(place.name);
  expect(result.current.tooltipBadge).not.toBeNull();
  state.org = "demo-org-b";
  rerender();
  expect(result.current.menuLugar).toBeNull();
  expect(result.current.tooltipBadge).toBeNull();
  act(() => result.current.configurarDesdeMenu());
  expect(result.current.form.name).toBe("");
});

it.each([
  ["vial", null, false],
  [
    "vial",
    [
      [1, 1],
      [2, 2],
    ],
    true,
  ],
  ["interno", null, true],
] as const)(
  "requires confirmation when a recovered %s route has lost its calculated path",
  (kind, path, confirmed) => {
    vi.useFakeTimers();
    const points: LatLon[] = [
      [1, 1],
      [2, 2],
    ];
    guardarBorrador("geografico", JSON.stringify([state.user, state.org]), {
      tipo: "trayecto",
      tray: {
        ...TRAY_VACIO,
        name: "Demo route",
        kind,
        confirmado: true,
        pts: points,
        recorrido: recorridoDesdePts(points),
      },
      paso: "datos",
      original: null,
      inicial: null,
      pathAjustado: path ? path.map(([a, b]) => [a, b]) : null,
    });
    const { result, unmount } = renderHook(() =>
      usePlacesWorkspace({ current: null })
    );
    act(() => {
      expect(result.current.restaurarBorrador()).toBe(true);
    });
    expect(result.current.tray.confirmado).toBe(confirmed);
    if (!confirmed) expect(result.current.pasoTrayecto).toBe("recorrido");
    unmount();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
);

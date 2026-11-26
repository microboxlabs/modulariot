import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FORM_VACIO,
  PARENT_KEY,
  TRAY_VACIO,
  type LatLon,
  type Lugar,
  type Trayecto,
} from "../places.types";
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
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({ MAPBOX_API_KEY: state.token }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
import type { MapMouseEvent } from "react-map-gl";
import { recorridoDesdePts } from "../routes/recorrido";
import { guardarBorrador } from "../data/draft-store";
import { usePlacesEnMapa } from "./use-places-en-mapa";
vi.mock("../map/place-name-layer", () => ({ capasNombresGeocercas: () => [] }));
import { usePlacesWorkspace } from "./use-places-workspace";
import type { FilaImport } from "../import-export/import-places";

/** El External ID se revisa tras dejar de escribir; hasta entonces no se guarda. */
const esperarCodigos = (result: {
  current: ReturnType<typeof usePlacesWorkspace>;
}) =>
  waitFor(() => {
    expect(result.current.estadoCodigoLugar?.estado).not.toBe("revisando");
    expect(result.current.estadoCodigoTrayecto?.estado).not.toBe("revisando");
  });

beforeEach(() => {
  globalThis.localStorage.clear();
  state.org = "demo-org-a";
  state.user = "demo-user-a";
  state.token = "";
  state.swr.mockReset().mockReturnValue({ data: undefined, mutate: vi.fn() });
});

describe("Places batch import", () => {
  const parent: Lugar = {
    place_id: "11111111-1111-1111-1111-111111111111",
    name: "Demo parent",
    address: null,
    category: null,
    category_id: null,
    geometry_type: "circle",
    color: null,
    center: [10, 10],
    polygon: null,
    radius_m: 20,
    metadata: {},
    external_id: "DEMO-PARENT",
    active_from: null,
    active_until: null,
  };
  const first: Lugar = {
    ...parent,
    place_id: "22222222-2222-2222-2222-222222222222",
    name: "First inner",
    center: [0, 0],
    external_id: "DEMO-FIRST",
    metadata: { [PARENT_KEY]: parent.place_id },
  };
  const second: Lugar = {
    ...first,
    place_id: "33333333-3333-3333-3333-333333333333",
    name: "Second inner",
    center: [1, 1],
    external_id: "DEMO-SECOND",
  };
  const row = (name: string, coordinate: number): FilaImport => ({
    uid: name,
    name,
    lat: coordinate,
    lon: coordinate,
    geometry_type: "circle",
    radius_m: 20,
  });
  const importRows = (
    result: { current: ReturnType<typeof usePlacesWorkspace> },
    filas: FilaImport[]
  ) =>
    act(() =>
      result.current.setImp((s) => ({
        ...s,
        lotes: [{ filename: "demo.csv", formato: "csv", filas }],
        decisiones: Object.fromEntries(
          filas.map((f) => [f.uid!, "nuevo" as const])
        ),
      }))
    );

  it("preserves an earlier inner edit when another row updates the same parent", async () => {
    const initial = {
      lugares: [parent, first, second],
      trayectos: [],
      metadatos: {},
    };
    let current = structuredClone(initial);
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data: key?.[0] === "/app/api/places/items" ? initial : undefined,
      mutate: async () => current,
    }));
    const fetch = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      current = {
        ...current,
        lugares: [
          parent,
          ...body.inners.map((inner: { id: string; name: string }) => ({
            ...(inner.id === first.place_id ? first : second),
            name: inner.name,
          })),
        ],
      };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: parent.place_id }),
      };
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    importRows(result, [row("First imported", 0), row("Second imported", 1)]);
    await act(async () => {
      await result.current.confirmarImport();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fetch.mock.calls[1]![1].body).inners.map(
        (inner: { name: string }) => inner.name
      )
    ).toEqual(["First imported", "Second imported"]);
    expect(result.current.guardando).toBe(false);
  });

  it("never deletes a conflicting place after a rejected replacement", async () => {
    const a = { ...first, metadata: {} };
    const b = { ...second, center: [0, 0] as LatLon, metadata: {} };
    const data = { lugares: [a, b], trayectos: [], metadatos: {} };
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data: key?.[0] === "/app/api/places/items" ? data : undefined,
      mutate: async () => data,
    }));
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Conflict" }),
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    importRows(result, [row("Replacement", 0)]);
    await act(async () => {
      await result.current.confirmarImport();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1].method).toBe("PUT");
    expect(result.current.imp.resultado).toContain("rechazadas");
    expect(result.current.guardando).toBe(false);
  });
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
    // only miot-places: StreamHub's geofences are moving into Lugares
    expect([...new Set(reads.map(([key]) => key[0]))].sort()).toEqual([
      "/app/api/places/items",
    ]);
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

describe("Places deletion", () => {
  it("deletes a saved route in miot-places by its External ID", async () => {
    const route: Trayecto = {
      trayecto_id: "22222222-2222-2222-2222-222222222222",
      name: "Demo route",
      kind: "vial",
      width_m: null,
      points: [
        [1, 1],
        [2, 2],
      ],
      waypoints: null,
      parent_name: null,
      ajustado: false,
      external_id: "RUTA 1",
    };
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data:
        key?.[0] === "/app/api/places/items"
          ? { lugares: [], trayectos: [route] }
          : undefined,
      mutate: vi.fn(),
    }));
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => result.current.borrarTrayecto(route));
    await act(async () => {
      result.current.confirmacion?.accion();
    });
    expect(fetch).toHaveBeenCalledWith("/app/api/places/items?code=RUTA%201", {
      method: "DELETE",
    });
  });
});

describe("Places versions", () => {
  const padre: Lugar = {
    place_id: "33333333-3333-3333-3333-333333333333",
    name: "Demo plant",
    address: null,
    category: null,
    category_id: null,
    geometry_type: "polygon",
    color: null,
    center: [-33.5, -70.5],
    polygon: [
      [-33, -70],
      [-32, -70],
      [-32, -69],
    ],
    radius_m: null,
    metadata: {},
    external_id: "DEMO-PLANT",
    active_from: null,
    active_until: null,
    version: "1.2.0",
  };
  const hijo: Lugar = {
    ...padre,
    place_id: "44444444-4444-4444-4444-444444444444",
    name: "Demo dock",
    geometry_type: "circle",
    center: [-32.5, -69.5],
    polygon: null,
    radius_m: 20,
    metadata: { [PARENT_KEY]: padre.place_id },
    version: null,
  };

  const conGuardados = () => {
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data:
        key?.[0] === "/app/api/places/items"
          ? { lugares: [padre, hijo], trayectos: [] }
          : undefined,
      mutate: vi.fn(),
    }));
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: padre.place_id }),
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("asks for the version of an edit and sends it with every inner geofence", async () => {
    const fetch = conGuardados();
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => result.current.editarLugar(padre));
    act(() => result.current.setForm((f) => ({ ...f, name: "Demo plant 2" })));
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.versionPendiente?.actual).toBe("1.2.0");

    await act(async () => {
      result.current.confirmarVersion("PATCH", "Renamed");
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`/app/api/places/items/${padre.place_id}`);
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body.version).toEqual({
      bump: "PATCH",
      reason: "Renamed",
      changes: ["Nombre: «Demo plant» → «Demo plant 2»"],
    });
    expect(body.inners).toHaveLength(1);
    expect(body.inners[0]).toMatchObject({
      id: hijo.place_id,
      kind: "inner_geofence",
    });
  });

  it("keeps polygon holes and hidden typed inner metadata in a name edit", async () => {
    const hole: LatLon[] = [
      [0.5, 0.5],
      [0.5, 1],
      [1, 1],
      [1, 0.5],
    ];
    const savedParent = {
      ...padre,
      polygon: [
        [0, 0],
        [0, 4],
        [4, 4],
        [4, 0],
      ] as LatLon[],
      polygon_holes: [hole],
    };
    const savedInner = {
      ...hijo,
      geometry_type: "polygon",
      polygon: savedParent.polygon,
      polygon_holes: [hole],
      radius_m: null,
    };
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data:
        key?.[0] === "/app/api/places/items"
          ? {
              lugares: [savedParent, savedInner],
              trayectos: [],
              metadatos: {
                [hijo.place_id]: { count: 2, details: { zone: "A" } },
              },
            }
          : undefined,
      mutate: vi.fn(),
    }));
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: padre.place_id }),
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    expect(result.current.fcPropios.features[0]?.geometry).toMatchObject({
      type: "Polygon",
      coordinates: expect.arrayContaining([
        expect.any(Array),
        expect.any(Array),
      ]),
    });
    act(() => result.current.editarLugar(savedParent));
    act(() => result.current.setForm((f) => ({ ...f, name: "Demo renamed" })));
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    await act(async () => {
      result.current.confirmarVersion("PATCH", "Renamed");
    });
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.geojson.geometry.coordinates).toHaveLength(2);
    expect(body.inners[0].geojson.geometry.coordinates).toHaveLength(2);
    expect(body.inners[0].metadata).toEqual({
      count: 2,
      details: { zone: "A" },
    });
  });

  it("saves nothing when an edit changes nothing", async () => {
    const fetch = conGuardados();
    const { toast } = await import("sonner");
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => result.current.editarLugar(padre));
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.versionPendiente).toBeNull();
    expect(toast.info).toHaveBeenCalledWith("No hay cambios que guardar.");
  });

  it("removes an inner geofence as a minor version of its geofence", async () => {
    const fetch = conGuardados();
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => result.current.borrarLugar(hijo));
    await act(async () => {
      result.current.confirmacion?.accion();
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`/app/api/places/items/${padre.place_id}`);
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body.inners).toEqual([]);
    expect(body.version).toMatchObject({
      bump: "MINOR",
      changes: ["Geocerca interior quitada: «Demo dock»"],
    });
  });
});

describe("Places External ID in use", () => {
  const enUso = {
    inUse: true,
    placeId: "p-otra",
    name: "Hola",
    kind: "geofence",
  };
  const texto = "En uso por «Hola»";
  const conCodigoTomado = () => {
    state.swr.mockImplementation((key: readonly string[] | null) => ({
      data: key?.[0]?.includes("code-usage") ? enUso : undefined,
      mutate: vi.fn(),
    }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };
  it("does not save a place with a code in use and says why", async () => {
    const fetch = conCodigoTomado();
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => {
      result.current.setModo("lugar");
      result.current.setForm({
        ...FORM_VACIO,
        name: "Demo draft",
        external_id: "DEMO-1",
        lat: 1,
        lon: 1,
      });
    });
    await waitFor(() =>
      expect(result.current.estadoCodigoLugar).toEqual({
        estado: "en-uso",
        aviso: texto,
      })
    );

    await esperarCodigos(result);

    await act(async () => {
      await result.current.guardarLugar();
    });
    // the field says why; nothing above the buttons
    expect(result.current.msg).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    act(() => result.current.continuarAInteriores());
    expect(result.current.pasoLugar).toBe("geocerca");
  });

  it("does not save a route with a code in use and says why", async () => {
    const fetch = conCodigoTomado();
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    const points: [number, number][] = [
      [1, 1],
      [2, 2],
    ];
    act(() => {
      result.current.setModo("trayecto");
      result.current.setTray({
        ...TRAY_VACIO,
        name: "Demo route",
        external_id: "DEMO-R1",
        confirmado: true,
        pts: points,
        recorrido: recorridoDesdePts(points),
      });
    });
    await waitFor(() =>
      expect(result.current.estadoCodigoTrayecto).toEqual({
        estado: "en-uso",
        aviso: texto,
      })
    );

    await esperarCodigos(result);

    await act(async () => {
      await result.current.guardarTrayecto();
    });
    // the field says why; nothing above the buttons
    expect(result.current.msg).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Places creation", () => {
  const nuevoLugar = (result: {
    current: ReturnType<typeof usePlacesWorkspace>;
  }) =>
    act(() => {
      result.current.setModo("lugar");
      result.current.setForm({
        ...FORM_VACIO,
        name: "Demo draft",
        external_id: "DEMO-1",
        lat: 1,
        lon: 1,
      });
    });

  it("saves a new place in miot-places, never in StreamHub or PT4", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "11111111-1111-1111-1111-111111111111" }),
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    nuevoLugar(result);
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("/app/api/places/items");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      kind: "geofence",
      name: "Demo draft",
      geojson: {
        geometry: { type: "Point", coordinates: [1, 1] },
        properties: { radius_m: 20 },
      },
    });
    expect(result.current.modo).toBe("ver");
    expect(result.current.local.lugares).toEqual([]);
  });

  it("shows an error and saves nothing when the server does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { toast } = await import("sonner");
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    nuevoLugar(result);
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("No se pudo guardar")
    );
    expect(result.current.modo).toBe("lugar");
    expect(result.current.form.name).toBe("Demo draft");
    expect(result.current.todosLugares).toEqual([]);
    expect(result.current.local.lugares).toEqual([]);
  });

  it("does not keep a route in this browser when the server does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    const points: LatLon[] = [
      [1, 1],
      [2, 2],
    ];
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    act(() => {
      result.current.setModo("trayecto");
      result.current.setTray({
        ...TRAY_VACIO,
        name: "Demo route",
        external_id: "DEMO-R1",
        kind: "interno",
        confirmado: true,
        pts: points,
        recorrido: recorridoDesdePts(points),
      });
    });
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarTrayecto();
    });
    expect(result.current.modo).toBe("trayecto");
    expect(result.current.local.trayectos).toEqual([]);
  });

  it("shows why the server refused the place and keeps the form open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: "another current place of that kind already has that code",
        }),
      })
    );
    const { result } = renderHook(() => usePlacesWorkspace({ current: null }));
    nuevoLugar(result);
    await esperarCodigos(result);
    await act(async () => {
      await result.current.guardarLugar();
    });
    expect(result.current.modo).toBe("lugar");
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
        external_id: "DEMO-R1",
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

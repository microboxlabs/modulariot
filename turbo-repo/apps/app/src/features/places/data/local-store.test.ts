import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  fusionarPorId,
  isLocalId,
  lugarDesdeForm,
  newLocalId,
  readLocal,
  trayectoDesdeForm,
  useLocalPlaces,
} from "./local-store";
import { COLOR_KEY, FORM_VACIO, TRAY_VACIO } from "../places.types";

describe("local-store", () => {
  beforeEach(() => window.localStorage.clear());

  it("generates ids recognised as local", () => {
    expect(isLocalId(newLocalId())).toBe(true);
    expect(isLocalId("9b1c-server-id")).toBe(false);
    expect(isLocalId(null)).toBe(false);
  });

  it("builds a circle place from the form with its category", () => {
    const l = lugarDesdeForm(
      {
        ...FORM_VACIO,
        name: "Planta",
        category_id: "2",
        lat: -33.4,
        lon: -70.6,
        radius_m: 300,
        metadata: [{ k: "turno", v: "noche" }],
      },
      [{ category_id: 2, name: "Planta", color: "#FF0000" }],
      "local-1"
    );
    expect(l).toMatchObject({
      place_id: "local-1",
      center: [-33.4, -70.6],
      polygon: null,
      radius_m: 300,
      category: "Planta",
      color: "#FF0000",
      metadata: { turno: "noche" },
    });
  });

  it("keeps a custom geofence color over the category color", () => {
    const l = lugarDesdeForm(
      {
        ...FORM_VACIO,
        name: "Planta",
        category_id: "2",
        color: "#E02424",
        lat: -33.4,
        lon: -70.6,
      },
      [{ category_id: 2, name: "Planta", color: "#FF0000" }],
      "local-1"
    );
    expect(l.color).toBe("#E02424");
    expect(l.metadata).toMatchObject({ [COLOR_KEY]: "#E02424" });
  });

  it("uses the street-adjusted path for adjusted routes", () => {
    const adj: [number, number][] = [
      [1, 1],
      [1.5, 1.5],
      [2, 2],
    ];
    const t = trayectoDesdeForm(
      {
        ...TRAY_VACIO,
        name: "Acceso",
        pts: [
          [1, 1],
          [2, 2],
        ],
        ajustado: true,
      },
      adj,
      "local-t"
    );
    expect(t.points).toEqual(adj);
    expect(t.waypoints).toHaveLength(2);
  });

  it("keeps a route's categories in the local backup", () => {
    const con = trayectoDesdeForm(
      { ...TRAY_VACIO, categorias: ["acceso", "minera"] },
      null,
      "local-t"
    );
    expect(con.categorias).toEqual(["acceso", "minera"]);
    expect(con.tipos_puntos).toEqual([]);
    expect(
      trayectoDesdeForm({ ...TRAY_VACIO }, null, "x").categorias
    ).toBeNull();
  });

  it("persists, updates and deletes places in localStorage", () => {
    const { result } = renderHook(() => useLocalPlaces("demo-user:org"));
    const l = lugarDesdeForm(
      { ...FORM_VACIO, name: "A", lat: 1, lon: 1 },
      [],
      "local-a"
    );

    act(() => void result.current.saveLugar(l));
    expect(readLocal("demo-user:org").lugares).toHaveLength(1);

    act(() => void result.current.saveLugar({ ...l, name: "B" }));
    expect(result.current.lugares.map((x) => x.name)).toEqual(["B"]);

    act(() => void result.current.deleteLugar("local-a"));
    expect(readLocal("demo-user:org").lugares).toHaveLength(0);
  });

  it("keeps local drafts isolated when the active identity changes", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useLocalPlaces(scope),
      { initialProps: { scope: "demo-user-a:org-a" } }
    );
    const draft = lugarDesdeForm(
      { ...FORM_VACIO, name: "Demo private draft", lat: 1, lon: 1 },
      [],
      "local-demo"
    );
    act(() => void result.current.saveLugar(draft));
    rerender({ scope: "demo-user-a:org-b" });
    expect(result.current.lugares).toEqual([]);
    rerender({ scope: "demo-user-b:org-a" });
    expect(result.current.lugares).toEqual([]);
    rerender({ scope: "demo-user-a:org-a" });
    expect(result.current.lugares.map((place) => place.name)).toEqual([
      "Demo private draft",
    ]);
  });

  it("does not expose ambiguous legacy drafts or persist without a resolved scope", () => {
    const draft = lugarDesdeForm(
      { ...FORM_VACIO, name: "Legacy demo", lat: 1, lon: 1 },
      [],
      "local-legacy"
    );
    window.localStorage.setItem(
      "miot.settings.places.local.v1",
      JSON.stringify({ lugares: [draft], trayectos: [] })
    );
    const { result } = renderHook(() => useLocalPlaces(null));
    expect(result.current.lugares).toEqual([]);
    act(() => expect(result.current.saveLugar(draft)).toBe(false));
    expect(readLocal("demo-user:org").lugares).toEqual([]);
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem(
      "miot.settings.places.local.v1:demo-user%3Aorg",
      "{nope"
    );
    expect(readLocal("demo-user:org")).toEqual({ lugares: [], trayectos: [] });
  });

  it("local copies replace the server version with the same id", () => {
    const id = (x: { id: string }) => x.id;
    const merged = fusionarPorId(
      [
        { id: "a", v: "server" },
        { id: "b", v: "server" },
      ],
      [{ id: "a", v: "local" }],
      id
    );
    expect(merged).toEqual([
      { id: "b", v: "server" },
      { id: "a", v: "local" },
    ]);
  });
});

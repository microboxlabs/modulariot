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
import { FORM_VACIO, TRAY_VACIO } from "./places.types";

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

  it("persists, updates and deletes places in localStorage", () => {
    const { result } = renderHook(() => useLocalPlaces());
    const l = lugarDesdeForm(
      { ...FORM_VACIO, name: "A", lat: 1, lon: 1 },
      [],
      "local-a"
    );

    act(() => void result.current.saveLugar(l));
    expect(readLocal().lugares).toHaveLength(1);

    act(() => void result.current.saveLugar({ ...l, name: "B" }));
    expect(result.current.lugares.map((x) => x.name)).toEqual(["B"]);

    act(() => void result.current.deleteLugar("local-a"));
    expect(readLocal().lugares).toHaveLength(0);
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem("miot.settings.places.local.v1", "{nope");
    expect(readLocal()).toEqual({ lugares: [], trayectos: [] });
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

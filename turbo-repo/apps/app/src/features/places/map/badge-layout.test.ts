import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX_SEPARAR,
  agruparSolapes,
  centroDeAnclas,
  empaquetarChips,
  pixelesMundo,
  zoomParaSeparar,
} from "./badge-layout";
import type { LatLon } from "../places.types";

type Item = { id: string; ancla: LatLon; prioridad: number };

const medida = () => ({ w: 100, h: 24, dy: 0 });
const item = (id: string, ancla: LatLon, prioridad = 0): Item => ({
  id,
  ancla,
  prioridad,
});

describe("badge layout", () => {
  it("projects to world pixels like Mapbox", () => {
    expect(pixelesMundo([0, 0], 0)).toEqual([256, 256]);
    const [x2] = pixelesMundo([0, 0], 1);
    expect(x2).toBe(512);
  });

  it("groups badges that would overlap, hiding none", () => {
    const items = [
      item("chico", [0, 0], 1),
      item("grande", [0, 0.0001], 5),
      item("lejos", [10, 10], 0),
    ];
    const ids = (gs: Item[][]) => gs.map((g) => g.map((i) => i.id));
    // the higher priority one leads its group
    expect(ids(agruparSolapes(items, 14, medida, (i) => i.prioridad))).toEqual([
      ["grande", "chico"],
      ["lejos"],
    ]);
    // zoomed in enough they no longer overlap: one badge each
    expect(ids(agruparSolapes(items, 22, medida, (i) => i.prioridad))).toEqual([
      ["grande"],
      ["chico"],
      ["lejos"],
    ]);
  });

  it("clusters titles that come within a small margin of each other", () => {
    // at zoom 10 on the equator, 1 px ≈ 1 / 1456.36 degrees of longitude
    const px = (n: number) => n / ((512 * 2 ** 10) / 360);
    const juntos = (separacionPx: number) =>
      agruparSolapes(
        [item("a", [0, 0], 1), item("b", [0, px(separacionPx)], 0)],
        10,
        medida,
        (i) => i.prioridad
      ).length === 1;
    // 100 px wide titles plus a 24 px margin: 126 px apart stay apart
    expect(juntos(126)).toBe(false);
    // 120 px apart they would look cramped: one cluster
    expect(juntos(120)).toBe(true);
  });

  it("puts a title touching two clusters in the closer one", () => {
    const px = (n: number) => n / ((512 * 2 ** 10) / 360);
    const fila = [
      item("a", [0, 0], 3),
      item("b", [0, px(220)], 2),
      // touches both a (120 px away) and b (100 px away)
      item("c", [0, px(120)], 1),
    ];
    const ids = (gs: Item[][]) => gs.map((g) => g.map((i) => i.id));
    expect(ids(agruparSolapes(fila, 10, medida, (i) => i.prioridad))).toEqual([
      ["a"],
      ["b", "c"],
    ]);
  });

  it("only clusters what touches the cluster's own badge, never in a chain", () => {
    // a-b touch, b-c touch, but c does not reach a (where the cluster is
    // drawn): c keeps its own badge instead of being dragged in through b
    const fila = [
      item("a", [0, 0], 3),
      // at zoom 16, ~75 px apart each (titles are 100 px wide)
      item("b", [0, 0.0008], 2),
      item("c", [0, 0.0016], 1),
    ];
    const ids = (gs: Item[][]) => gs.map((g) => g.map((i) => i.id));
    expect(ids(agruparSolapes(fila, 16, medida, (i) => i.prioridad))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("packs images in rows and starts a new atlas page when full", () => {
    const chips = Array.from({ length: 5 }, (_, i) => ({
      key: `c${i}`,
      width: 100,
      height: 40,
    }));
    // 2 per row in a 220 px atlas, 2 rows per 100 px page
    const paginas = empaquetarChips(chips, 220, 100);
    expect(paginas.map((p) => Object.keys(p.posiciones).length)).toEqual([
      4, 1,
    ]);
    const p0 = paginas[0]!.posiciones;
    expect(p0.c0).toEqual({ x: 4, y: 4, width: 100, height: 40 });
    expect(p0.c1?.x).toBe(108);
    expect(p0.c2?.y).toBe(48);
    // an image wider than the atlas widens its page
    const [ancha] = empaquetarChips(
      [{ key: "w", width: 500, height: 10 }],
      220
    );
    expect(ancha?.ancho).toBe(508);
  });

  it("zooms in just enough to split a cluster", () => {
    const juntos = [item("a", [0, 0], 2), item("b", [0, 0.0001], 1)];
    const z = zoomParaSeparar(juntos, 14, medida, (i) => i.prioridad);
    // a bit closer than now, and at that zoom they no longer go together
    expect(z).toBeGreaterThan(14);
    expect(z).toBeLessThan(ZOOM_MAX_SEPARAR);
    expect(agruparSolapes(juntos, z, medida, (i) => i.prioridad)).toHaveLength(
      2
    );
    // one step less and they would still be one badge
    expect(
      agruparSolapes(juntos, z - 0.25, medida, (i) => i.prioridad)
    ).toHaveLength(1);
  });

  it("stops at the cap when places sit on the very same point", () => {
    const mismo = [item("a", [0, 0]), item("b", [0, 0])];
    expect(zoomParaSeparar(mismo, 14, medida, (i) => i.prioridad)).toBe(
      ZOOM_MAX_SEPARAR
    );
  });

  it("centers on the middle of the cluster", () => {
    expect(centroDeAnclas([item("a", [0, 0]), item("b", [2, 4])])).toEqual([
      1, 2,
    ]);
  });
});

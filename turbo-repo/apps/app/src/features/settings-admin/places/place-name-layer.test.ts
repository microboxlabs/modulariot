import { describe, expect, it, vi } from "vitest";
import {
  capasNombresGeocercas,
  chipEtiqueta,
  temaChipMapa,
} from "./place-name-layer";
import type { ItemNombre } from "./place-labels";

vi.stubGlobal(
  "Path2D",
  class Path2D {
    constructor(_d?: string) {}
  }
);

function mockCanvas() {
  HTMLCanvasElement.prototype.getContext = () =>
    ({
      font: "",
      measureText: (t: string) => ({ width: t.length * 7 }),
      setTransform: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      arcTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      stroke: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      scale: () => undefined,
      fillText: () => undefined,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "round",
      lineJoin: "round",
      textBaseline: "middle",
      textAlign: "left",
    }) as unknown as CanvasRenderingContext2D;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,xx";
}

const padre: ItemNombre = {
  id: "park",
  name: "geofence 1 de prueba",
  color: "#1C64F2",
  icon: "pin",
  ancla: [-33, -70],
  inner: false,
  radio_m: 250,
};

const hijo: ItemNombre = {
  id: "lot",
  name: "Lote VIP",
  color: "#E02424",
  icon: "",
  ancla: [-33, -70],
  inner: true,
  parentId: "park",
  radio_m: 40,
};

describe("place name deck layer", () => {
  it("renders parent and child names as a single IconLayer of chips", () => {
    const layers = capasNombresGeocercas(
      [padre, hijo],
      "place-names-1",
      "dark",
      4
    );
    expect(layers).toHaveLength(1);
    const capa = layers[0];
    expect(capa?.id).toBe("place-names-1");
    const props = capa?.props as {
      data: ItemNombre[];
      getPosition: (d: ItemNombre) => [number, number];
      getPixelOffset: (d: ItemNombre) => [number, number];
      pickable: boolean;
    };
    expect(props.data).toEqual([padre]);
    expect(props.getPosition(padre)).toEqual([-70, -33]);
    expect(props.getPixelOffset(padre)).toEqual([0, -18]);
    expect(props.getPixelOffset(hijo)).toEqual([0, 0]);
    expect(props.pickable).toBe(true);
  });

  it("clusters child chips into the parent name when zoomed out", () => {
    const lejos = capasNombresGeocercas(
      [padre, hijo],
      "place-names-1",
      "dark",
      4
    );
    const cerca = capasNombresGeocercas(
      [padre, hijo],
      "place-names-1",
      "dark",
      20
    );
    const dataLejos = (lejos[0]?.props as { data: ItemNombre[] }).data;
    const dataCerca = (cerca[0]?.props as { data: ItemNombre[] }).data;
    expect(dataLejos.map((i) => i.id)).toEqual(["park"]);
    expect(dataCerca.map((i) => i.id)).toEqual(["lot"]);
  });

  it("uses a night chip on dark/satellite maps and a day chip on streets", () => {
    expect(temaChipMapa("dark")).toBe("noche");
    expect(temaChipMapa("satellite")).toBe("noche");
    expect(temaChipMapa("streets")).toBe("dia");
    expect(temaChipMapa("light")).toBe("dia");
  });

  it("draws the icon inside a badge wider than it is tall", () => {
    mockCanvas();
    const chip = chipEtiqueta(padre, "noche");
    expect(chip.size).toBe(24);
    expect(chip.height).toBeGreaterThanOrEqual(48);
    expect(chip.width).toBeGreaterThan(chip.height);
    expect(chip.anchorX).toBe(chip.width / 2);
    expect(chip.url.startsWith("data:image/png")).toBe(true);
  });
});

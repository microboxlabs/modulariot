import { describe, expect, it, vi } from "vitest";
import {
  capasNombresGeocercas,
  altoCluster,
  altoNombre,
  chipCluster,
  lineasDeNombre,
  contarCluster,
  partesCluster,
  chipEtiqueta,
  textoCluster,
  type BadgeMapa,
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
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return {
      canvas: this,
      drawImage: () => undefined,
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
    } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"];
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

type CapaBadges = {
  id: string;
  props: {
    data: BadgeMapa[];
    iconAtlas: HTMLCanvasElement;
    iconMapping: Record<string, { width: number; height: number }>;
    getIcon: (b: BadgeMapa) => string;
    getPosition: (b: BadgeMapa) => [number, number];
    getPixelOffset: (b: BadgeMapa) => [number, number];
    onHover: (info: { object?: BadgeMapa }) => void;
    onClick: (info: { object?: BadgeMapa }) => void;
    pickable: boolean;
    opacity?: number;
  };
};

type Op = NonNullable<Parameters<typeof capasNombresGeocercas>[1]>;
/** Las opciones en orden, para escribir los casos más cortos. */
const capas = (
  items: ItemNombre[],
  layerId?: string,
  mapStyle?: string,
  zoom?: number,
  onNombre?: Op["onNombre"],
  onHoverNombre?: Op["onHoverNombre"],
  resaltadoAnim?: Op["resaltadoAnim"],
  onHoverBadge?: Op["onHoverBadge"],
  onAcercar?: Op["onAcercar"]
) =>
  capasNombresGeocercas(items, {
    layerId,
    mapStyle,
    zoom,
    onNombre,
    onHoverNombre,
    resaltadoAnim,
    onHoverBadge,
    onAcercar,
  }) as unknown as CapaBadges[];

const solo = (item: ItemNombre): BadgeMapa => ({ item, miembros: [item] });
const lejos: [number, number] = [-20, -60];

describe("place name deck layer", () => {
  it("draws badges from its own atlas, with the image map", () => {
    mockCanvas();
    const otro = { ...padre, id: "far", name: "Otra planta", ancla: lejos };
    const [capa] = capas([padre, otro], "place-names-1", "dark", 14);
    expect(capa?.id).toBe("place-names-1-0");
    const p = capa!.props;
    expect(p.iconAtlas).toBeInstanceOf(HTMLCanvasElement);
    // every badge points to an entry of the atlas map
    for (const b of p.data) expect(p.iconMapping[p.getIcon(b)]).toBeDefined();
    expect(p.getPosition(solo(padre))).toEqual([-70, -33]);
    expect(p.getPixelOffset(solo(padre))).toEqual([0, -18]);
    expect(p.getPixelOffset(solo(hijo))).toEqual([0, 0]);
    expect(p.pickable).toBe(true);
  });

  it("joins overlapping places into one cluster", () => {
    mockCanvas();
    // two places at the same spot, zoomed out: one cluster
    const vecino = { ...padre, id: "park-2", radio_m: 100 };
    const [capa] = capas([padre, vecino], "n", "dark", 4);
    expect(capa?.props.data).toHaveLength(1);
    const cluster = capa!.props.data[0]!;
    expect(cluster.miembros.map((m) => m.id)).toEqual(["park", "park-2"]);
    // places far apart keep a badge each
    const otro = { ...padre, id: "far", ancla: lejos };
    expect(capas([padre, otro], "n", "dark", 14)[0]?.props.data).toHaveLength(
      2
    );
  });

  it("keeps inners inside their parent's badge until it opens", () => {
    mockCanvas();
    // zoomed out: the parent alone, not a cluster with its inner
    const [lejosCapa] = capas([padre, hijo], "n", "dark", 4);
    expect(
      lejosCapa!.props.data.map((b) => b.miembros.map((m) => m.id))
    ).toEqual([["park"]]);
    // zoomed in: the inner takes the parent's place
    const [cerca] = capas([padre, hijo], "n", "dark", 18);
    expect(cerca!.props.data.map((b) => b.miembros.map((m) => m.id))).toEqual([
      ["lot"],
    ]);
  });

  it("opens a cluster on click instead of going to one of its places", () => {
    mockCanvas();
    const onNombre = vi.fn();
    const onAcercar = vi.fn();
    const otro = {
      ...padre,
      id: "park-2",
      ancla: [-33, -70.0005] as [number, number],
    };
    const [capa] = capas(
      [padre, otro],
      "n",
      "dark",
      4,
      onNombre,
      undefined,
      undefined,
      undefined,
      onAcercar
    );
    const cluster = capa!.props.data[0]!;
    expect(cluster.miembros).toHaveLength(2);
    capa!.props.onClick({ object: cluster });
    expect(onNombre).not.toHaveBeenCalled();
    const [centro, z] = onAcercar.mock.calls[0]!;
    expect(centro).toEqual([-33, -70.00025]);
    expect(z).toBeGreaterThan(4);
    // a single badge still goes to its place
    capa!.props.onClick({ object: solo(padre) });
    expect(onNombre).toHaveBeenCalledWith(padre);
  });

  it("draws a cluster as a pill counting its geofences and routes", () => {
    mockCanvas();
    expect(textoCluster({ geocercas: 5, trayectos: 0 })).toBe("5 geocercas");
    expect(textoCluster({ geocercas: 2, trayectos: 1 })).toBe(
      "2 geocercas · 1 trayecto"
    );
    expect(textoCluster({ geocercas: 1, trayectos: 3 })).toBe(
      "1 geocerca · 3 trayectos"
    );
    // each kind with its own icon
    expect(
      partesCluster({ geocercas: 2, trayectos: 1 }).map((p) => p.icono)
    ).toEqual(["pin", "ruta"]);
    const ruta = { ...padre, id: "t1", trayectoId: "t1" };
    expect(contarCluster([padre, hijo, ruta])).toEqual({
      geocercas: 2,
      trayectos: 1,
    });
    const chip = chipCluster({ geocercas: 5, trayectos: 0 }, "noche");
    expect(chip.size).toBe(24);
    expect(chip.key).toBe("cluster|5|0|noche");
    // geofences and routes together: one row each, stacked in a column
    const mixto = chipCluster({ geocercas: 2, trayectos: 1 }, "noche");
    expect(mixto.size).toBe(altoCluster(2));
    expect(altoCluster(2)).toBeGreaterThan(24);
    expect(altoCluster(1)).toBe(24);
    // the cluster badge sits where a parent badge would
    const vecino = { ...padre, id: "park-2" };
    const [capa] = capas([padre, vecino], "n", "dark", 4);
    const cluster = capa!.props.data[0]!;
    expect(capa!.props.getIcon(cluster)).toBe("cluster|2|0|noche");
    expect(capa!.props.getPixelOffset(cluster)).toEqual([0, -18]);
  });

  it("reports the badge under the mouse, and null for clusters or leaving", () => {
    mockCanvas();
    const onHover = vi.fn();
    const [capa] = capas([padre], "n", "dark", 4, undefined, onHover);
    capa!.props.onHover({ object: solo(padre) });
    expect(onHover).toHaveBeenLastCalledWith(padre);
    capa!.props.onHover({ object: { item: padre, miembros: [padre, hijo] } });
    expect(onHover).toHaveBeenLastCalledWith(null);
    capa!.props.onHover({});
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("draws the badge hovered in the list on top, fading in", () => {
    mockCanvas();
    const ls = capas([padre, hijo], "n", "dark", 4, undefined, undefined, {
      id: "lot",
      t: 0.5,
    });
    const resaltado = ls.at(-1)!;
    expect(resaltado.id).toBe("n-resaltado");
    expect(resaltado.props.opacity).toBe(0.5);
    // finished fading out: no highlight layer
    expect(
      capas([padre], "n", "dark", 4, undefined, undefined, { id: null, t: 0 })
    ).toHaveLength(1);
  });

  it("uses a night chip on dark/satellite maps and a day chip on streets", () => {
    expect(temaChipMapa("dark")).toBe("noche");
    expect(temaChipMapa("satellite")).toBe("noche");
    expect(temaChipMapa("streets")).toBe("dia");
  });

  it("draws the icon inside a badge wider than it is tall", () => {
    mockCanvas();
    const chip = chipEtiqueta(padre, "noche");
    expect(chip.size).toBe(24);
    expect(chip.height).toBeGreaterThanOrEqual(48);
    expect(chip.width).toBeGreaterThan(chip.height);
    expect(chip.canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it("never cuts a name: a long one goes on to more lines", () => {
    // 7 px per character, as the canvas mock measures
    const ancho = (t: string) => t.length * 7;
    expect(lineasDeNombre(ancho, "Mall Zofri Iqq")).toEqual(["Mall Zofri Iqq"]);
    const largo = "SITIO DEL TRANSPORTISTA LUIS ALBERTO CORNEJO GUZMAN- TC";
    const lineas = lineasDeNombre(ancho, largo);
    expect(lineas.length).toBeGreaterThan(1);
    expect(lineas.join(" ")).toBe(largo);
    for (const l of lineas) expect(ancho(l)).toBeLessThanOrEqual(168);
    // a single word wider than a line is split, still whole
    const palabra = "X".repeat(40);
    expect(lineasDeNombre(ancho, palabra).join("")).toBe(palabra);
  });

  it("draws a long name as a taller badge that grows away from its place", () => {
    mockCanvas();
    const largo = {
      ...padre,
      id: "largo",
      name: "PREDIO TRANSPORTES HECTOR ARAYA SOTO",
      ancla: lejos,
    };
    const chip = chipEtiqueta(largo, "noche");
    expect(chip.size).toBe(altoNombre(2));
    expect(chip.size).toBeGreaterThan(24);
    const [capa] = capas([largo], "n", "dark", 14);
    // the bottom edge stays where a one-line badge's would be
    const extra = (chip.size - 24) / 2;
    expect(capa!.props.getPixelOffset(solo(largo))).toEqual([0, -18 - extra]);
    // a short name keeps the usual badge
    expect(chipEtiqueta(padre, "noche").size).toBe(24);
  });

  it("puts the badge of a saved conflict below its shape", () => {
    mockCanvas();
    const guardado = { ...padre, id: "saved", ancla: lejos, abajo: true };
    const [capa] = capas([guardado], "n", "dark", 14);
    expect(capa!.props.getPixelOffset(solo(guardado))).toEqual([0, 22]);
  });
});

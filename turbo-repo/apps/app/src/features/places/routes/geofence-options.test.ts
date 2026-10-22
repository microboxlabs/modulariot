import { describe, expect, it } from "vitest";
import { PARENT_KEY, type Lugar } from "../places.types";
import { opcionesGeocerca } from "./geofence-options";

const lugar = (over: Partial<Lugar>): Lugar =>
  ({
    place_id: "p",
    name: "",
    address: null,
    external_id: null,
    center: null,
    polygon: null,
    metadata: null,
    ...over,
  }) as Lugar;

describe("opcionesGeocerca", () => {
  const circulo = lugar({
    place_id: "c",
    name: "Bodega Norte",
    address: "Av. Uno 1",
    center: [-33, -70],
  });
  const poligono = lugar({
    place_id: "q",
    name: "Puerto Sur",
    external_id: "PS-01",
    polygon: [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ],
  });

  it("lists every geofence when nothing is typed, at its centre", () => {
    const xs = opcionesGeocerca([circulo, poligono], "");
    expect(xs.map((x) => x.nombre)).toEqual(["Bodega Norte", "Puerto Sur"]);
    expect(xs[0]).toMatchObject({
      id: "geocerca:c",
      punto: [-33, -70],
      contexto: "Av. Uno 1",
      geocerca: true,
    });
    expect(xs[1]?.punto).toEqual([1, 1]);
  });

  it("matches name, address or external id", () => {
    expect(opcionesGeocerca([circulo, poligono], "ps-0")).toHaveLength(1);
    expect(opcionesGeocerca([circulo, poligono], "av. uno")[0]?.nombre).toBe(
      "Bodega Norte"
    );
    expect(opcionesGeocerca([circulo, poligono], "nada")).toEqual([]);
  });

  it("leaves out inner geofences, places without a shape and extras", () => {
    const interior = lugar({
      place_id: "i",
      name: "Bodega Norte · andén",
      center: [-33, -70],
      metadata: { [PARENT_KEY]: "c" },
    });
    const sinForma = lugar({ place_id: "s", name: "Bodega vacía" });
    expect(
      opcionesGeocerca([circulo, interior, sinForma], "bodega").map((x) => x.id)
    ).toEqual(["geocerca:c"]);
    const muchas = Array.from({ length: 9 }, (_, i) =>
      lugar({ place_id: `m${i}`, name: `G${i}`, center: [0, 0] })
    );
    expect(opcionesGeocerca(muchas, "")).toHaveLength(5);
  });
});

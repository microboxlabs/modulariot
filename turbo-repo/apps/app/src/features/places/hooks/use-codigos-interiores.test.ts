import { describe, expect, it } from "vitest";
import { estadosDeInteriores } from "./use-codigos-interiores";

const padre = { codigo: "SCL-01", nombre: "Planta" };
const nunca = () => false;
const interior = (id: string, name: string, external_id: string) => ({
  id,
  name,
  external_id,
});

describe("estadosDeInteriores", () => {
  it("is checking until the server answers, then free or in use", () => {
    const inners = [
      interior("a", "Andén", "AND-1"),
      interior("b", "Patio", "PAT-1"),
    ];
    expect(estadosDeInteriores(inners, padre, null, nunca)).toEqual({
      a: { estado: "revisando" },
      b: { estado: "revisando" },
    });
    const usos = {
      "and-1": { inUse: false, placeId: null, name: null, kind: null },
      "pat-1": {
        inUse: true,
        placeId: "otra",
        name: "Bodega",
        kind: "geofence",
      },
    };
    expect(estadosDeInteriores(inners, padre, usos, nunca)).toEqual({
      a: { estado: "libre" },
      b: { estado: "en-uso", aviso: "En uso por «Bodega»" },
    });
  });

  it("is in use when it repeats its geofence's code or another inner's, whatever the case", () => {
    const inners = [
      interior("a", "Andén", "scl-01"),
      interior("b", "Patio", "LOTE"),
      interior("c", "Lote", "lote"),
    ];
    expect(estadosDeInteriores(inners, padre, null, nunca)).toEqual({
      a: { estado: "en-uso", aviso: "En uso por «Planta»" },
      b: { estado: "en-uso", aviso: "En uso por «Lote»" },
      c: { estado: "en-uso", aviso: "En uso por «Patio»" },
    });
  });

  it("says nothing of an empty code or a saved one, which cannot change", () => {
    const inners = [
      interior("a", "Andén", " "),
      interior("b", "Patio", "PAT-1"),
    ];
    expect(
      estadosDeInteriores(inners, padre, null, (id) => id === "b")
    ).toEqual({});
  });
});

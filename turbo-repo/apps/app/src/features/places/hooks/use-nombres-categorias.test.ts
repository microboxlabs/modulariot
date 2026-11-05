import { describe, expect, it } from "vitest";
import { conNombresDeCategoria } from "./use-nombres-categorias";
import {
  CATEGORIAS_KEY,
  CATEGORIAS_LISTA_KEY,
  type Lugar,
} from "../places.types";

const lugar = (over: Partial<Lugar>) =>
  ({
    place_id: "p",
    name: "Planta",
    category: null,
    metadata: null,
    ...over,
  }) as Lugar;
const conCodigos = (codigos: string[], lista = "familias") =>
  lugar({
    metadata: {
      [CATEGORIAS_KEY]: JSON.stringify(codigos),
      [CATEGORIAS_LISTA_KEY]: lista,
    },
  });
const opciones = {
  familias: [
    { value: "driving_safety", label: { es: "Conducción", en: "Driving" } },
    { value: "fatiga", label: { es: "Fatiga" } },
  ],
} as never;

describe("conNombresDeCategoria", () => {
  it("names the codes from the place's own selectable", () => {
    const [l] = conNombresDeCategoria(
      [conCodigos(["driving_safety", "fatiga"])],
      opciones,
      "es"
    );
    expect(l?.category).toBe("Conducción, Fatiga");
  });

  it("uses the language of the page", () => {
    const [l] = conNombresDeCategoria(
      [conCodigos(["driving_safety"])],
      opciones,
      "en"
    );
    expect(l?.category).toBe("Driving");
  });

  it("shows a code that is not in the list, or whose list did not load", () => {
    const [viejo, sinLista] = conNombresDeCategoria(
      [conCodigos(["vieja"]), conCodigos(["fatiga"], "otra")],
      opciones,
      "es"
    );
    expect(viejo?.category).toBe("vieja");
    expect(sinLista?.category).toBe("fatiga");
  });

  it("leaves a place without codes as it came", () => {
    const streamhub = lugar({ category: "Zona de riesgo" });
    const [l] = conNombresDeCategoria([streamhub], opciones, "es");
    expect(l).toBe(streamhub);
  });
});

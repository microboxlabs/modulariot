import { describe, expect, it, vi } from "vitest";
import { fetchSelectableOptions } from "@/features/settings-admin/selectables/selectables-api";
import {
  conNombresDeCategoria,
  opcionesDeCodigos,
  trayectosConNombres,
} from "./use-nombres-categorias";

vi.mock("@/features/settings-admin/selectables/selectables-api", () => ({
  fetchSelectableOptions: vi.fn(),
  useApiSelectables: vi.fn(),
}));
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

  it("names a route's categories from its own list", () => {
    const ruta = {
      trayecto_id: "t",
      name: "Ruta",
      kind: "vial",
      width_m: null,
      points: [],
      waypoints: null,
      parent_name: null,
      ajustado: null,
      external_id: null,
      categorias: ["fatiga", "ya_no_esta"],
      categorias_lista: "familias",
    };
    const [t] = trayectosConNombres([ruta], opciones, "es");
    expect(t?.categorias_nombres).toBe("Fatiga, ya_no_esta");
    const sin = { ...ruta, categorias: [] };
    expect(trayectosConNombres([sin], opciones, "es")[0]).toBe(sin);
  });

  it("looks up a saved code that is not among the first options", async () => {
    const primera = { value: "a", label: { es: "A" } };
    const lejana = { value: "z9", label: { es: "Zona 9" } };
    vi.mocked(fetchSelectableOptions).mockImplementation(async (_key, q) =>
      q?.search === "z9"
        ? [{ value: "z90", label: { es: "Zona 90" } }, lejana]
        : [primera]
    );
    expect(await opcionesDeCodigos("zonas", ["a", "z9"])).toEqual([
      primera,
      lejana,
    ]);
    expect(fetchSelectableOptions).toHaveBeenCalledWith("zonas", {
      limit: 200,
    });
    expect(fetchSelectableOptions).toHaveBeenCalledWith("zonas", {
      search: "z9",
      limit: 200,
    });
    expect(fetchSelectableOptions).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  FORM_VACIO,
  CATEGORIAS_KEY,
  COLOR_KEY,
  COLOR_LUGAR_DEF,
  categoriasDeLugar,
  ICON_KEY,
  colorDeFormLugar,
  colorDeLugar,
  iconoDeLugar,
  metadataAFilas,
  metadataParaGuardar,
  type Lugar,
} from "./places.types";

describe("place metadata helpers", () => {
  it("drops empty keys and stores the icon under the reserved key", () => {
    expect(
      metadataParaGuardar({
        ...FORM_VACIO,
        icon: "bodega",
        metadata: [
          { k: " turno ", v: " noche " },
          { k: "", v: "huérfano" },
        ],
      })
    ).toEqual({ turno: "noche", [ICON_KEY]: "bodega" });
  });

  it("hides the icon key from the editable rows", () => {
    expect(metadataAFilas({ a: "1", [ICON_KEY]: "casa" })).toEqual([
      { k: "a", v: "1" },
    ]);
  });

  it("reads the icon from the local field or the metadata", () => {
    const base = { metadata: null } as Lugar;
    expect(iconoDeLugar({ ...base, icon: "casa" })).toBe("casa");
    expect(iconoDeLugar({ ...base, metadata: { [ICON_KEY]: "bodega" } })).toBe(
      "bodega"
    );
    expect(iconoDeLugar(base)).toBe("");
  });

  it("prefers the reserved color metadata over the category color", () => {
    const base = { metadata: null, color: "#00FF00" } as Lugar;
    expect(colorDeLugar(base)).toBe("#00FF00");
    expect(
      colorDeLugar({ ...base, metadata: { [COLOR_KEY]: "#E02424" } })
    ).toBe("#E02424");
    expect(metadataAFilas({ [COLOR_KEY]: "#E02424", a: "1" })).toEqual([
      { k: "a", v: "1" },
    ]);
  });

  it("stores a custom geofence color under the reserved key", () => {
    expect(metadataParaGuardar({ ...FORM_VACIO, color: "#E02424" })).toEqual({
      [COLOR_KEY]: "#E02424",
    });
  });

  it("uses the picked color, then the category, then the default", () => {
    const cats = [{ category_id: 2, name: "Planta", color: "#00FF00" }];
    expect(colorDeFormLugar(FORM_VACIO)).toBe(COLOR_LUGAR_DEF);
    expect(colorDeFormLugar({ ...FORM_VACIO, category_id: "2" }, cats)).toBe(
      "#00FF00"
    );
    expect(
      colorDeFormLugar(
        { ...FORM_VACIO, category_id: "2", color: "#E02424" },
        cats
      )
    ).toBe("#E02424");
  });
});

describe("place categories", () => {
  it("saves several categories in reserved metadata and reads them back", () => {
    const meta = metadataParaGuardar({
      ...FORM_VACIO,
      categorias: ["bodega", "cliente"],
    });
    expect(meta[CATEGORIAS_KEY]).toBe('["bodega","cliente"]');
    expect(categoriasDeLugar({ metadata: meta })).toEqual([
      "bodega",
      "cliente",
    ]);
    // reserved: not shown as an editable metadata row
    expect(metadataAFilas(meta).map((f) => f.k)).not.toContain(CATEGORIAS_KEY);
  });

  it("omits the key without categories and ignores unreadable values", () => {
    expect(metadataParaGuardar({ ...FORM_VACIO })).not.toHaveProperty(
      CATEGORIAS_KEY
    );
    expect(categoriasDeLugar({ metadata: null })).toEqual([]);
    expect(
      categoriasDeLugar({ metadata: { [CATEGORIAS_KEY]: "no json" } })
    ).toEqual([]);
    expect(
      categoriasDeLugar({ metadata: { [CATEGORIAS_KEY]: "[1,2]" } })
    ).toEqual([]);
  });
});

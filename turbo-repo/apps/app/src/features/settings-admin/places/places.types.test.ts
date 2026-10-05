import { describe, expect, it } from "vitest";
import {
  FORM_VACIO,
  ICON_KEY,
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
});

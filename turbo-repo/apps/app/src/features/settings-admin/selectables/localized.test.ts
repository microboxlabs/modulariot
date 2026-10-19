import { describe, expect, it } from "vitest";
import { slugify, toListKey } from "./localized";

describe("slugify", () => {
  it("drops accents and turns every run of other characters into one underscore", () => {
    expect(slugify("  __Región   Sur!!  ")).toBe("region_sur");
    expect(slugify("Viña del Mar")).toBe("vina_del_mar");
    expect(slugify("!!!")).toBe("");
  });

  it("cuts at the limit without leaving an underscore at the end", () => {
    expect(slugify("abc def", 4)).toBe("abc");
  });
});

describe("toListKey", () => {
  it("starts with a letter", () => {
    expect(toListKey("Motivos de retraso")).toBe("motivos_de_retraso");
    expect(toListKey("3 turnos")).toBe("list_3_turnos");
    expect(toListKey("¿?")).toBe("list");
  });

  it("always gives a key the API accepts: 2 to 64 characters", () => {
    const valid = /^[a-z][a-z0-9_]{1,63}$/;
    expect(toListKey("A")).toMatch(valid);
    expect(toListKey("7")).toMatch(valid);
    expect(toListKey("1".repeat(80))).toMatch(valid);
    expect(toListKey("a".repeat(80))).toMatch(valid);
  });
});

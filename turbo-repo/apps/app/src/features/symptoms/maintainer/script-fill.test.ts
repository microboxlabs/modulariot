import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import { blankLabel, filledParts, partsText } from "./script-fill";

const labels = es.pages.userSettings.symptomCatalog.scriptField;

describe("filledParts", () => {
  it("fills what the case has and names each blank from the field's label", () => {
    const parts = filledParts(
      "Hola {{trip.driver.name}}, el {{patente}} va por {{ruta}}",
      { vehicle: { plate: "AB-12" }, trip: {} },
      labels
    );
    expect(parts).toEqual([
      { text: "Hola " },
      { blank: "[nombre del conductor]" },
      { text: ", el AB-12 va por " },
      { blank: "[origen → destino]" },
    ]);
    expect(partsText(parts)).toBe(
      "Hola [nombre del conductor], el AB-12 va por [origen → destino]"
    );
  });

  it("names a field with no label by its last segment and keeps acronyms", () => {
    expect(blankLabel("trip.driver.nickname", labels)).toBe("[nickname]");
    expect(blankLabel("trip.driver.rut", labels)).toBe("[RUT del conductor]");
    expect(blankLabel("constructor", labels)).toBe("[constructor]");
    expect(blankLabel("trip.code", undefined)).toBe("[code]");
  });

  it.each([
    "Hola {{trip.driver-name}}",
    "Hola {{trip.driver.name",
    "Hola {{ {{trip.driver.name}}",
  ])("hides unsupported or unfinished syntax in %s", (script) => {
    const text = partsText(filledParts(script, undefined, labels));
    expect(text).not.toContain("{{");
    expect(text).toContain("[");
  });
});

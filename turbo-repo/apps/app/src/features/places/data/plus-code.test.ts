import { describe, expect, it } from "vitest";
import { decodificar, extraerPlusCode, recuperarCorto } from "./plus-code";
import type { LatLon } from "../places.types";

/** Dos puntos iguales hasta ~10 cm (la librería redondea a 6 decimales). */
const cerca = (a: LatLon | null, b: LatLon | null) => {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a![0]).toBeCloseTo(b![0], 5);
  expect(a![1]).toBeCloseTo(b![1], 5);
};

describe("plus codes", () => {
  it("decodes a full code to the centre of its area", () => {
    // the specification's example (Zürich)
    cerca(decodificar("8FVC9G8F+6X"), [47.3655625, 8.5249375]);
    // lower case works too (the library alone does not read it)
    cerca(decodificar("8fvc9g8f+6x"), [47.3655625, 8.5249375]);
    // southern and western hemispheres: a code in Santiago
    const [lat, lon] = decodificar("47RFJ9QR+7R")!;
    expect(lat).toBeGreaterThan(-34);
    expect(lat).toBeLessThan(-33);
    expect(lon).toBeGreaterThan(-71);
    expect(lon).toBeLessThan(-70);
  });

  it("decodes padded low-precision codes to the centre of their cell", () => {
    cerca(decodificar("8FVC0000+"), [47.5, 8.5]);
  });

  it("rejects what is not on the globe", () => {
    // the library would return latitude 307 for this one
    expect(decodificar("XXVC9G8F+6X")).toBeNull();
  });

  it("places a short code in the cell nearest the reference", () => {
    cerca(recuperarCorto("9G8F+6X", [47.4, 8.6]), [47.3655625, 8.5249375]);
    // across a cell border it still picks the nearest one
    cerca(
      recuperarCorto("J9QR+7R", [-33.45, -70.66]),
      decodificar("47RFJ9QR+7R")
    );
  });

  it("finds a code in what was typed, with its locality", () => {
    expect(extraerPlusCode("8fvc9g8f+6x")).toEqual({
      codigo: "8FVC9G8F+6X",
      completo: true,
      resto: "",
    });
    expect(extraerPlusCode("J9QR+7R Santiago, Chile")).toEqual({
      codigo: "J9QR+7R",
      completo: false,
      resto: "Santiago Chile",
    });
    expect(extraerPlusCode("8FVC0000+")).toMatchObject({
      codigo: "8FVC0000+",
      completo: true,
    });
  });

  it("ignores ordinary addresses and malformed codes", () => {
    expect(extraerPlusCode("Av. Providencia 1234")).toBeNull();
    expect(extraerPlusCode("Ruta 5 + 12")).toBeNull();
    // "+" in an odd position, or a single digit after it
    expect(extraerPlusCode("9G8+6X")).toBeNull();
    expect(extraerPlusCode("9G8F+6")).toBeNull();
    // a full code outside the globe
    expect(extraerPlusCode("XXVC9G8F+6X")).toBeNull();
    // padding only in full codes, in pairs at the end, nothing after "+"
    expect(extraerPlusCode("9G00+")).toBeNull();
    expect(extraerPlusCode("8FV00000+")).toBeNull();
    expect(extraerPlusCode("8FVC0000+6X")).toBeNull();
    expect(extraerPlusCode("8F0C9G8F+6X")).toBeNull();
  });
});

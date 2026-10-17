import { describe, expect, it } from "vitest";
import { decodificar, extraerPlusCode, recuperarCorto } from "./plus-code";

const cerca = (a: [number, number], b: [number, number], eps = 1e-5) => {
  expect(a[0]).toBeCloseTo(b[0], -Math.log10(eps));
  expect(a[1]).toBeCloseTo(b[1], -Math.log10(eps));
};

describe("plus codes", () => {
  it("decodes a full code to the centre of its area", () => {
    // the specification's example (Zürich)
    cerca(decodificar("8FVC9G8F+6X"), [47.3655625, 8.5249375]);
    // grid digits after the 10th narrow it further
    cerca(decodificar("8FVC9G8F+6XQ"), [47.3655625, 8.5249375], 1e-3);
    // southern and western hemispheres: a code in Santiago
    const [lat, lon] = decodificar("47RFJ9QR+7R");
    expect(lat).toBeGreaterThan(-34);
    expect(lat).toBeLessThan(-33);
    expect(lon).toBeGreaterThan(-71);
    expect(lon).toBeLessThan(-70);
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
  });

  it("ignores ordinary addresses and malformed codes", () => {
    expect(extraerPlusCode("Av. Providencia 1234")).toBeNull();
    expect(extraerPlusCode("Ruta 5 + 12")).toBeNull();
    // "+" in an odd position, or a single digit after it
    expect(extraerPlusCode("9G8+6X")).toBeNull();
    expect(extraerPlusCode("9G8F+6")).toBeNull();
    // a full code outside the globe
    expect(extraerPlusCode("XXVC9G8F+6X")).toBeNull();
  });
});

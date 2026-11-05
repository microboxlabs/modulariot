import { describe, expect, it } from "vitest";
import en from "@/lang/en.json";
import es from "@/lang/es.json";
import { reviewNote } from "./review-note";

const notes = es.pages.userSettings.geocoding.review.notes;

describe("reviewNote", () => {
  it("says a point in another district in Spanish, with both districts", () => {
    expect(
      reviewNote(
        "the point is in Quilicura (13125), not in Santiago (13101)",
        notes
      )
    ).toBe("El punto está en Quilicura (13125), no en Santiago (13101)");
  });

  it("names the provider and what it found", () => {
    expect(reviewNote("mapbox found only street, not an address", notes)).toBe(
      "Mapbox solo encontró street, no la dirección"
    );
  });

  it("keeps parentheses in district names", () => {
    expect(
      reviewNote(
        "the point is in District Alpha (North) (101), not in District Beta (South) (202)",
        notes
      )
    ).toBe(
      "El punto está en District Alpha (North) (101), no en District Beta (South) (202)"
    );
  });

  it("translates a point outside the country", () => {
    expect(
      reviewNote("the point is outside CL, not in District Alpha (101)", notes)
    ).toBe("El punto está fuera de CL, no en District Alpha (101)");
  });

  it("leaves a long malformed point note unchanged", () => {
    const note = `the point is in ${"District (101), not in ".repeat(10000)}District (bad-code)`;
    expect(reviewNote(note, notes)).toBe(note);
  });

  it("keeps a point note when its translation is missing", () => {
    const note =
      "the point is in District Alpha (101), not in District Beta (202)";
    expect(reviewNote(note, {})).toBe(note);
  });

  it("keeps the quota number", () => {
    expect(
      reviewNote(
        "geocoding: the organization used its 1000 geocoding resolutions for this month",
        notes
      )
    ).toBe("La organización usó sus 1000 consultas de geocodificación del mes");
  });

  it.each([
    [
      "the address names no district and is not in the internal addresses",
      "The address names no district and was not found in the internal addresses",
      "La dirección no indica un distrito y no se encontró en las direcciones internas",
    ],
    [
      "district code is too long",
      "The district code is too long",
      "El código del distrito es demasiado largo",
    ],
    [
      "district name is too long",
      "The district name is too long",
      "El nombre del distrito es demasiado largo",
    ],
    [
      "geocoding: the platform has no geocoding provider",
      "The platform has no geocoding provider configured",
      "La plataforma no tiene un proveedor de geocodificación configurado",
    ],
    [
      "geocoding: this organization's geocoding connection cannot be read",
      "The organization's geocoding connection could not be read",
      "No se pudo leer la conexión de geocodificación de la organización",
    ],
    [
      "geocoding: this organization's geocoding connection is not managed by the platform",
      "The organization's geocoding connection is not managed by the platform",
      "La conexión de geocodificación de la organización no está administrada por la plataforma",
    ],
    [
      "geocoding: no organization to geocode for",
      "No organization was provided for geocoding",
      "No se indicó una organización para geocodificar",
    ],
    [
      "geocoding: the geocoding connection's costPerRequestUsd is not a number",
      "The geocoding provider's cost per call is not a number",
      "El costo por consulta del proveedor de geocodificación no es un número",
    ],
    [
      "geocoding: the geocoding connection's credential has no token",
      "The geocoding provider's credential has no token",
      "La credencial del proveedor de geocodificación no tiene un token",
    ],
    [
      "geocoding: interrupted",
      "The geocoding call was interrupted",
      "La consulta de geocodificación se interrumpió",
    ],
  ])("translates the built-in note %s", (note, english, spanish) => {
    expect(reviewNote(note, en.pages.userSettings.geocoding.review.notes)).toBe(
      english
    );
    expect(reviewNote(note, notes)).toBe(spanish);
  });

  it("keeps provider and connection details in translated notes", () => {
    expect(
      reviewNote("geocoding: unknown geocoding provider synthetic", notes)
    ).toBe("Proveedor de geocodificación desconocido: Synthetic");
    expect(
      reviewNote(
        "geocoding: the geocoding connection must use synthetic-endpoint",
        notes
      )
    ).toBe("La conexión de geocodificación debe usar synthetic-endpoint");
  });

  it("leaves a note named like an object property unchanged", () => {
    expect(reviewNote("toString", notes)).toBe("toString");
  });

  it("shows a note it does not know as it came", () => {
    expect(reviewNote("geocoding: Mapbox answered HTTP 401", notes)).toBe(
      "geocoding: Mapbox answered HTTP 401"
    );
  });

  it("shows the note as it came without a dictionary", () => {
    expect(reviewNote("district is required", undefined)).toBe(
      "district is required"
    );
  });
});

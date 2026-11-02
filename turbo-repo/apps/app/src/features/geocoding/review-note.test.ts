import { describe, expect, it } from "vitest";
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

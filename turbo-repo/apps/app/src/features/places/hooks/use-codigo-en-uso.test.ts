import { describe, expect, it } from "vitest";
import { avisoDeCodigo } from "./use-codigo-en-uso";

const libre = { inUse: false, placeId: null, name: null, kind: null };
const tomado = {
  inUse: true,
  placeId: "p-1",
  name: "SITRANS SANTIAGO",
  kind: "geofence",
};

describe("avisoDeCodigo", () => {
  it("says nothing about a free code", () => {
    expect(avisoDeCodigo(null, libre)).toBeNull();
    expect(avisoDeCodigo(null, undefined)).toBeNull();
  });

  it("names the place that holds the code", () => {
    expect(avisoDeCodigo(null, tomado)).toBe("En uso por «SITRANS SANTIAGO»");
  });

  it("does not count the place being edited", () => {
    expect(avisoDeCodigo("p-1", tomado)).toBeNull();
  });
});

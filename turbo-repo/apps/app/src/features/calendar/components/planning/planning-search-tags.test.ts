import { describe, it, expect } from "vitest";
import { freightTagValue } from "./planning-search-tags";

describe("freightTagValue", () => {
  it("writes a service type the way the rest of the app does", () => {
    // Stored lower-cased — the form the coordinator holds and matches on —
    // and shown the way the kanban writes it on `1681596-V`.
    expect(freightTagValue({ matchType: "tipoServicio", value: "v" })).toBe("V");
    expect(freightTagValue({ matchType: "tipoServicio", value: "otr" })).toBe(
      "OTR"
    );
  });

  it("leaves every other value as it is", () => {
    expect(freightTagValue({ matchType: "origen", value: "ANF" })).toBe("ANF");
    expect(freightTagValue({ matchType: "cliente", value: "SPENCE" })).toBe(
      "SPENCE"
    );
  });
});

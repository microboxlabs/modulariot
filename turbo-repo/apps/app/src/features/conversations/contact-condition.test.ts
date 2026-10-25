import { describe, expect, it } from "vitest";
import {
  bookSuggestions,
  compileClauses,
  parseClauses,
} from "./contact-condition";

describe("contact condition", () => {
  it("writes the supervisor and the service's carrier as CEL and reads them back", () => {
    const carrier = compileClauses([
      { kind: "tag", value: "transportista" },
      { kind: "companyRutIs", field: "carrierRut" },
    ]);
    expect(carrier).toBe(
      "'transportista' in contact.tags && contact.companyRut == event.data.carrierRut"
    );
    expect(parseClauses(carrier)).toEqual([
      { kind: "tag", value: "transportista" },
      { kind: "companyRutIs", field: "carrierRut" },
    ]);
    expect(parseClauses('contact.role == "Supervisor de transporte"')).toEqual([
      { kind: "role", value: "Supervisor de transporte" },
    ]);
  });

  it("leaves what the clauses cannot say to the CEL editor", () => {
    expect(parseClauses("")).toEqual([]);
    expect(
      parseClauses("contact.role == 'a' || contact.role == 'b'")
    ).toBeNull();
    expect(parseClauses("(contact.role == 'a')")).toBeNull();
    expect(parseClauses("contact.name.startsWith('A')")).toBeNull();
    expect(parseClauses("contact.role == 'a || b'")).toEqual([
      { kind: "role", value: "a || b" },
    ]);
  });
});

describe("book suggestions", () => {
  it("counts the active contacts' tags, roles and companies, most used first", () => {
    const s = bookSuggestions([
      { role: "Despachador", tags: ["transportista", "Sur"], company: "A" },
      { role: "despachador", tags: ["Transportista"], company: "B" },
      { role: "Supervisor de transporte", tags: [], company: "A" },
      { role: "Otro", tags: ["transportista"], active: false },
    ]);
    expect(s.tag).toEqual([
      { value: "transportista", count: 2 },
      { value: "Sur", count: 1 },
    ]);
    expect(s.role[0]).toEqual({ value: "Despachador", count: 2 });
    expect(s.company).toEqual([
      { value: "A", count: 2 },
      { value: "B", count: 1 },
    ]);
  });
});

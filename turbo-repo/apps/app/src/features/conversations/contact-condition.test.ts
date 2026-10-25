import { describe, expect, it } from "vitest";
import { compileClauses, parseClauses } from "./contact-condition";

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

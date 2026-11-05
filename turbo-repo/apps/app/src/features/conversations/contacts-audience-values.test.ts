import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completions } from "@/features/symptoms/maintainer/cel-editor";
import { contactCelFields, contactCelValues } from "./contacts-audience";

const BOOK = {
  role: [
    { value: "Conductor", count: 794 },
    { value: "Gerente de Seguridad", count: 1 },
  ],
  company: [{ value: "Transportes Sur", count: 3 }],
};
const d = {
  contactWithValue: "1 contacto",
  contactsWithValue: "{count} contactos",
};

/** The labels offered with the cursor at the end of `doc`. */
function offered(doc: string): string[] {
  const state = EditorState.create({ doc });
  const result = completions(
    () => contactCelFields([]),
    () => contactCelValues(BOOK, d)
  )(new CompletionContext(state, doc.length, true));
  if (!result || result instanceof Promise) return [];
  return result.options.map((o) => o.label);
}

describe("contact condition values", () => {
  it("offers the book's roles inside a role comparison, in either quote", () => {
    expect(offered("contact.role == 'C")).toEqual([
      "Conductor",
      "Gerente de Seguridad",
    ]);
    expect(offered('contact.role == "')).toContain("Gerente de Seguridad");
  });

  it("offers the book's companies inside a company comparison", () => {
    expect(offered("contact.company == '")).toEqual(["Transportes Sur"]);
  });

  it("says how many active contacts have each value", () => {
    expect(contactCelValues(BOOK, d)["contact.role"]).toEqual([
      { value: "Conductor", detail: "794 contactos" },
      { value: "Gerente de Seguridad", detail: "1 contacto" },
    ]);
  });
});

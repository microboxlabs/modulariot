import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completions } from "@/features/symptoms/maintainer/cel-editor";
import { TRIP_FIELDS } from "@/features/symptoms/control-tower/step-who";
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

/** The options offered with the cursor at the end of `doc`. */
function options(doc: string, fields = contactCelFields([])) {
  const state = EditorState.create({ doc });
  const result = completions(
    () => fields,
    () => contactCelValues(BOOK, d)
  )(new CompletionContext(state, doc.length, true));
  if (!result || result instanceof Promise) return [];
  return result.options as { label: string; description?: string }[];
}

/** The labels offered with the cursor at the end of `doc`. */
function offered(doc: string): string[] {
  return options(doc).map((o) => o.label);
}

describe("a step's trip fields", () => {
  const stepFields = contactCelFields(TRIP_FIELDS);

  it("offers the trip's origin and destination, with their keys and geofences", () => {
    const labels = options("event.data.", stepFields).map((o) => o.label);
    for (const name of [
      "origin",
      "originKey",
      "originId",
      "destination",
      "destinationKey",
      "destinationId",
    ])
      expect(labels).toContain(name);
  });

  it("explains how the keys compare with the contact's tag keys", () => {
    const key = options("event.data.originK", stepFields).find(
      (o) => o.label === "originKey"
    );
    expect(key?.description).toContain("contact.tagKeys");
    const tagKeys = options("contact.tagK", stepFields).find(
      (o) => o.label === "tagKeys"
    );
    expect(tagKeys?.description).toContain("sin tildes");
  });
});

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

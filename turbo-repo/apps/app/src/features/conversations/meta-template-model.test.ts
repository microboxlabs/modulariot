import { describe, expect, it } from "vitest";
import type { MetaTemplate, MetaTemplateDraft } from "./conversations-types";
import {
  EMPTY_META_DRAFT,
  draftOf,
  draftParams,
  draftProblems,
  matchTemplates,
  statusTone,
} from "./meta-template-model";

const draft = (patch: Partial<MetaTemplateDraft>): MetaTemplateDraft => ({
  ...EMPTY_META_DRAFT,
  name: "trip_alert_v1",
  body: "Hola {{nombre}}, ¿todo bien?",
  examples: { nombre: "Juan" },
  ...patch,
});

const keys = (d: MetaTemplateDraft, isNew = true) =>
  draftProblems(d, isNew).map((p) => p.key);

const APPROVED: MetaTemplate = {
  id: "901",
  name: "panic_check",
  language: "es_CL",
  category: "UTILITY",
  status: "APPROVED",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: "TEXT",
  header: "Alerta {{patente}}",
  body: "Hola {{nombre}}, ¿estás bien? {{patente}} activó el botón.",
  footer: "Operaciones",
  buttons: [{ type: "QUICK_REPLY", text: "Estoy bien" }],
  params: ["nombre", "patente"],
  examples: { nombre: "Juan", patente: "TEST01" },
};

describe("draftProblems", () => {
  it("accepts a well formed draft", () => {
    expect(keys(draft({}))).toEqual([]);
  });

  it("checks the name only for a new template", () => {
    expect(keys(draft({ name: "Trip Alert" }))).toEqual(["metaErrName"]);
    expect(keys(draft({ name: "Trip Alert" }), false)).toEqual([]);
  });

  it("wants a body without a parameter at its edges and an example per parameter", () => {
    expect(keys(draft({ body: " " }))).toEqual(["metaErrBody"]);
    expect(keys(draft({ body: "{{nombre}}, hola" }))).toEqual([
      "metaErrBodyEdges",
    ]);
    expect(draftProblems(draft({ examples: {} }), true)).toEqual([
      { key: "metaErrExample", values: { name: "nombre" } },
    ]);
    expect(keys(draft({ body: "Hola {{Nombre}}, ok", examples: {} }))).toEqual([
      "metaErrParamName",
    ]);
  });

  it("limits the header and footer parameters", () => {
    expect(
      keys(
        draft({
          header: "{{a}} {{b}}",
          examples: { nombre: "J", a: "1", b: "2" },
        })
      )
    ).toEqual(["metaErrHeaderParams"]);
    expect(keys(draft({ footer: "{{nombre}}" }))).toEqual([
      "metaErrFooterParams",
    ]);
  });

  it("checks the buttons", () => {
    const url = (u: string) => ({ type: "URL" as const, text: "Ver", url: u });
    const quick = { type: "QUICK_REPLY" as const, text: "Sí" };
    expect(keys(draft({ buttons: [{ ...quick, text: "" }] }))).toEqual([
      "metaErrButtonText",
    ]);
    expect(keys(draft({ buttons: [url("ftp://x")] }))).toEqual([
      "metaErrButtonUrl",
    ]);
    expect(
      keys(
        draft({
          buttons: [{ type: "PHONE_NUMBER", text: "Llamar", phoneNumber: "1" }],
        })
      )
    ).toEqual(["metaErrButtonPhone"]);
    expect(
      keys(
        draft({
          buttons: [
            url("https://a.test"),
            url("https://a.test"),
            url("https://a.test"),
          ],
        })
      )
    ).toEqual(["metaErrUrlButtons"]);
    expect(
      keys(draft({ buttons: [quick, url("https://a.test"), quick] }))
    ).toEqual(["metaErrButtonGroups"]);
  });
});

describe("meta template helpers", () => {
  it("reads a template into a draft and lists its parameters once", () => {
    const d = draftOf(APPROVED);
    expect(d.header).toBe("Alerta {{patente}}");
    expect(draftParams(d)).toEqual(["patente", "nombre"]);
    expect(draftOf({ ...APPROVED, headerFormat: "IMAGE" }).header).toBe("");
    expect(draftOf(null)).toBe(EMPTY_META_DRAFT);
  });

  it("colors the statuses without amber or violet", () => {
    expect(statusTone("APPROVED")).toBe("green");
    expect(statusTone("PENDING")).toBe("blue");
    expect(statusTone("REJECTED")).toBe("red");
    expect(statusTone("PAUSED")).toBe("gray");
    expect(statusTone("DISABLED")).toBe("gray");
  });

  it("matches templates by every word of the query", () => {
    const list = [APPROVED, { ...APPROVED, id: "2", name: "trip_reminder" }];
    expect(matchTemplates(list, "panic es_cl").map((t) => t.id)).toEqual([
      "901",
    ]);
    expect(matchTemplates(list, "")).toHaveLength(2);
  });
});

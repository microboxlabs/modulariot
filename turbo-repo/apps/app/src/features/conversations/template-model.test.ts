import { describe, expect, it } from "vitest";
import type { MetaTemplate, TemplateBody } from "./conversations-types";
import {
  changedFields,
  exampleValues,
  htmlToText,
  metaNameFrom,
  sendParams,
  templateFindings,
  textToHtml,
  withHtml,
} from "./template-model";

const BODY: TemplateBody = {
  name: "Alerta",
  baseText: "Hola {{company}}: {{used}} de {{quota}}.",
  whatsapp: { metaName: "alerta", language: "es", params: [] },
  email: null,
};

const META: MetaTemplate = {
  id: "1",
  name: "alerta",
  language: "es",
  category: "UTILITY",
  status: "APPROVED",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: null,
  header: null,
  body: "Hola {{company}}.",
  footer: null,
  buttons: [],
  params: ["company"],
  examples: {},
};

const keys = (f: ReturnType<typeof templateFindings>) => f.map((x) => x.key);

describe("templateFindings", () => {
  it("asks for a name and a text, and says when only text channels can use it", () => {
    expect(
      keys(
        templateFindings({
          body: { name: " ", baseText: "", whatsapp: null, email: null },
          keyTaken: false,
          variables: null,
          metaTemplates: undefined,
        })
      )
    ).toEqual(["tplNoName", "tplNoText", "tplNoChannel"]);
  });

  it("names the variables the event does not give", () => {
    const [f] = templateFindings({
      body: { ...BODY, whatsapp: null, email: { subject: "{{x}}", body: "b" } },
      keyTaken: false,
      variables: ["company", "used", "quota"],
      metaTemplates: undefined,
    });
    expect(f).toMatchObject({
      key: "tplUnknownVariables",
      values: { names: "x" },
    });
  });

  it("says the template is not on Meta, or that its text differs from Meta's", () => {
    const base = { keyTaken: false, variables: null };
    expect(
      keys(templateFindings({ ...base, body: BODY, metaTemplates: [] }))
    ).toEqual(["tplNotOnMeta"]);
    expect(
      keys(templateFindings({ ...base, body: BODY, metaTemplates: [META] }))
    ).toEqual(["tplMetaTextDiffers"]);
  });
});

describe("sendParams", () => {
  it("takes Meta's parameters when Meta has the template, else the text's", () => {
    expect(sendParams(BODY, [META])).toEqual(["company"]);
    expect(sendParams(BODY, [])).toEqual(["company", "used", "quota"]);
  });
});

describe("exampleValues", () => {
  it("uses the known sample, a number for numeric fields, else the label", () => {
    expect(
      exampleValues(
        [
          { name: "company", label: "Empresa", type: "string" },
          { name: "count", label: "Cuenta", type: "long" },
          { name: "zone", label: "Zona", type: "string" },
        ],
        ["used", "other"]
      )
    ).toEqual({
      company: "Transportes Ejemplo",
      count: "42",
      zone: "Zona",
      used: "800",
    });
  });
});

describe("textToHtml, withHtml and htmlToText", () => {
  it("escapes the text and makes a paragraph per block", () => {
    expect(textToHtml("Hola {{a}} & <b>\nsigue\n\nfin")).toBe(
      "<p>Hola {{a}} &amp; &lt;b&gt;<br>\nsigue</p>\n<p>fin</p>"
    );
  });

  it("moves a plain-text body to HTML and leaves an HTML one alone", () => {
    expect(withHtml({ subject: "s", body: "a" })).toEqual({
      subject: "s",
      body: null,
      html: "<p>a</p>",
    });
    const html = { subject: "s", body: null, html: "<p>x</p>" };
    expect(withHtml(html)).toBe(html);
  });

  it("reads an HTML body's text", () => {
    expect(htmlToText("<h1>Hola</h1><p>A &amp; B<br>C</p>")).toBe(
      "Hola\nA & B\nC"
    );
  });

  it("preserves incomplete tags without repeatedly scanning each opening bracket", () => {
    const incomplete = "<".repeat(20_000);
    expect(htmlToText(`Text ${incomplete}`)).toBe(`Text ${incomplete}`);
  });

  it("does not ask for a short text when only the email sends", () => {
    expect(
      keys(
        templateFindings({
          body: {
            name: "x",
            baseText: "",
            whatsapp: null,
            email: { subject: "s", body: null, html: "<p>b</p>" },
          },
          keyTaken: false,
          variables: null,
          metaTemplates: undefined,
        })
      )
    ).toEqual([]);
  });
});

describe("changedFields and metaNameFrom", () => {
  it("lists what differs from the stored template", () => {
    expect(changedFields({ ...BODY, baseText: "x" }, BODY)).toEqual([
      "baseText",
    ]);
  });

  it("turns a key into a Meta name", () => {
    expect(metaNameFrom("alerta-de-cuota")).toBe("alerta_de_cuota");
    expect(metaNameFrom("___alerta__de_cuota___")).toBe("alerta__de_cuota");
    expect(metaNameFrom("_".repeat(20_000))).toBe("");
  });
});

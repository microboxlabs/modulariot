import { describe, it, expect } from "vitest";
import {
  buildSampleContext,
  findChannel,
  REVIEW_CHANNELS,
  renderTemplate,
  seedMappings,
  unmappedRequiredFields,
  VARIABLE_GROUPS,
} from "./review-integration.types";

const partner = findChannel("PARTNER_API")!;

describe("review-integration channel catalog", () => {
  it("exposes Partner API as the only available channel", () => {
    const available = REVIEW_CHANNELS.filter((channel) => channel.available);
    expect(available.map((channel) => channel.id)).toEqual(["PARTNER_API"]);
  });

  it("marks guidMultimedia, serviceCode and aprobado as required", () => {
    const required = partner.fields
      .filter((field) => field.required)
      .map((field) => field.id);
    expect(required).toEqual(["guidMultimedia", "serviceCode", "aprobado"]);
  });
});

describe("seedMappings", () => {
  it("pre-fills a Handlebars template for every field with a default", () => {
    const seeded = seedMappings(partner);
    expect(Object.keys(seeded).sort()).toEqual(
      partner.fields.map((field) => field.id).sort()
    );
    expect(seeded.guidMultimedia).toBe("{{content.integrationMediaId}}");
    expect(seeded.aprobado).toBe("{{review.verdict}}");
  });
});

describe("unmappedRequiredFields", () => {
  it("passes when every required field has a template", () => {
    expect(unmappedRequiredFields(partner, seedMappings(partner))).toEqual([]);
  });

  it("flags a required field with no template", () => {
    const mappings = seedMappings(partner);
    delete mappings.serviceCode;
    expect(
      unmappedRequiredFields(partner, mappings).map((f) => f.id)
    ).toEqual(["serviceCode"]);
  });

  it("treats a blank template on a required field as unmapped", () => {
    const mappings = { ...seedMappings(partner), aprobado: "   " };
    expect(
      unmappedRequiredFields(partner, mappings).map((f) => f.id)
    ).toEqual(["aprobado"]);
  });

  it("ignores optional fields even when they are blank", () => {
    const mappings = { ...seedMappings(partner), mensaje: "" };
    expect(unmappedRequiredFields(partner, mappings)).toEqual([]);
  });
});

describe("variable catalog + sample context", () => {
  it("groups variables by task / content / review / session", () => {
    expect(VARIABLE_GROUPS.map((g) => g.id)).toEqual([
      "task",
      "content",
      "review",
      "session",
    ]);
  });

  it("nests every variable's sample under its group", () => {
    const context = buildSampleContext();
    expect(context.content.integrationMediaId).toBe(
      "19f8f3a89a1-a8ad5969-48944a06"
    );
    expect(context.task.mintral_serviceCode).toBe("SRV-1649906");
    // Every catalogued variable is reachable in the context it builds.
    for (const group of VARIABLE_GROUPS) {
      for (const variable of group.variables) {
        const key = variable.path.slice(group.id.length + 1);
        expect(context[group.id][key]).toBe(variable.sample);
      }
    }
  });
});

describe("renderTemplate", () => {
  const context = buildSampleContext();

  it("resolves a single variable to its sample", () => {
    expect(renderTemplate("{{content.integrationMediaId}}", context)).toBe(
      "19f8f3a89a1-a8ad5969-48944a06"
    );
  });

  it("interpolates variables inside surrounding text", () => {
    expect(renderTemplate("svc {{task.mintral_serviceCode}}", context)).toBe(
      "svc SRV-1649906"
    );
  });

  it("does not HTML-escape resolved values", () => {
    expect(
      renderTemplate("{{review.comment}}", {
        review: { comment: "a & b" },
      })
    ).toBe("a & b");
  });

  it("returns the raw template on a compile error", () => {
    expect(renderTemplate("{{#if}}", context)).toBe("{{#if}}");
  });

  it("renders an empty template to an empty string", () => {
    expect(renderTemplate("", context)).toBe("");
  });
});

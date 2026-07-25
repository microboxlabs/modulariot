import { describe, it, expect } from "vitest";
import {
  ConnectionFormSchema,
  TemplateFormSchema,
  parseJsonObject,
  schemaLeafPaths,
} from "./integration-config.types";

describe("parseJsonObject", () => {
  it("returns the object for valid JSON", () => {
    const result = parseJsonObject('{"a": 1}');
    expect(result).toEqual({ value: { a: 1 } });
  });

  it("treats empty text as an empty object", () => {
    expect(parseJsonObject("   ")).toEqual({ value: {} });
  });

  it("rejects a top-level array — the schema must be an object", () => {
    expect(parseJsonObject("[1,2]")).toEqual({ error: "notObject" });
  });

  it("reports a parse error for malformed JSON", () => {
    const result = parseJsonObject("{ not json");
    expect("error" in result).toBe(true);
  });
});

describe("schemaLeafPaths", () => {
  it("lists scalar leaves of a flat object", () => {
    const schema = {
      type: "object",
      properties: { serviceCode: { type: "string" }, aprobada: { type: "boolean" } },
    };
    expect(schemaLeafPaths(schema)).toEqual(["serviceCode", "aprobada"]);
  });

  it("recurses through nested arrays and objects with dotted paths", () => {
    // A realistic review envelope: an object with an array of objects, one of which
    // itself holds an array of objects.
    const schema = {
      type: "object",
      properties: {
        serviceCode: { type: "string" },
        aprobada: { type: "boolean" },
        fotos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              guidMultimedia: { type: "string" },
              aprobada: { type: "boolean" },
              mensaje: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(schemaLeafPaths(schema)).toEqual([
      "serviceCode",
      "aprobada",
      "fotos.guidMultimedia",
      "fotos.aprobada",
      "fotos.mensaje.codigo",
      "fotos.mensaje.nombre",
    ]);
  });

  it("has no leaves for an empty schema", () => {
    expect(schemaLeafPaths({})).toEqual([]);
  });
});

/** Messages are dictionary keys; the modals resolve them against the page dictionary. */
function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe("ConnectionFormSchema", () => {
  const valid = {
    name: "Partner API · QA",
    baseUrl: "https://api.partner.example.com",
    credentialProfileId: "",
  };

  it("accepts an instance with no credential — the field is optional by value", () => {
    expect(ConnectionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a name", () => {
    const result = ConnectionFormSchema.safeParse({ ...valid, name: "" });
    expect(firstIssue(result)).toBe("validation.nameRequired");
  });

  it("rejects a base URL that is not a URL", () => {
    const result = ConnectionFormSchema.safeParse({
      ...valid,
      baseUrl: "api.partner.example.com",
    });
    expect(firstIssue(result)).toBe("validation.baseUrlInvalid");
  });
});

describe("TemplateFormSchema", () => {
  const valid = {
    name: "Partner API",
    providerType: "CUSTOM_HTTP",
    operationName: "Report verdict",
    method: "POST",
    path: "/api/v1/verdict",
    requestSchemaText: '{"type":"object","properties":{"a":{"type":"string"}}}',
  };

  it("accepts a well-formed contract", () => {
    expect(TemplateFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a path — the template owns it, not the instance", () => {
    const result = TemplateFormSchema.safeParse({ ...valid, path: "" });
    expect(firstIssue(result)).toBe("validation.pathRequired");
  });

  it("rejects payload text that is not a JSON object", () => {
    const result = TemplateFormSchema.safeParse({
      ...valid,
      requestSchemaText: "{ not json",
    });
    expect(firstIssue(result)).toBe("validation.schemaInvalid");
  });

  it("allows an empty payload schema — a contract with no mapped fields", () => {
    expect(
      TemplateFormSchema.safeParse({ ...valid, requestSchemaText: "" }).success
    ).toBe(true);
  });
});

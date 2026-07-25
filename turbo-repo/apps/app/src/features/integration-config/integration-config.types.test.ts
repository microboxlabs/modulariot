import { describe, it, expect } from "vitest";
import { parseJsonObject, schemaLeafPaths } from "./integration-config.types";

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
    // The Dev-Mentor-shaped envelope: an object with an array of objects, one of which
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

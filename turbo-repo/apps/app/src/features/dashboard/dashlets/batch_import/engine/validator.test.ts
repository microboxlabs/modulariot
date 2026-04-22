import { describe, it, expect } from "vitest";
import {
  buildRowSchema,
  validateRow,
  type IntrospectedParam,
} from "./validator";

const FUEL_MATCH_PARAMS: IntrospectedParam[] = [
  { name: "p_patente", type: "string", format: "text", required: true },
  {
    name: "p_fecha",
    type: "string",
    format: "date-time",
    required: true,
  },
  { name: "p_litros", type: "number", format: "numeric", required: true },
  { name: "p_odometro", type: "integer", format: "int4" },
  { name: "p_monto", type: "number", format: "numeric" },
  { name: "p_estacion", type: "string", format: "text" },
  { name: "p_guia", type: "string", format: "text" },
];

function validate(row: Record<string, string>, params = FUEL_MATCH_PARAMS) {
  return validateRow(row, buildRowSchema(params));
}

describe("buildRowSchema / validateRow", () => {
  it("accepts a fully valid row", () => {
    expect(
      validate({
        p_patente: "TRCG73",
        p_fecha: "2026-03-01T09:00:00-03:00",
        p_litros: "45.9",
        p_odometro: "23308",
        p_monto: "-39852",
        p_estacion: "Av. Américo Vespucio 5542",
        p_guia: "40988442",
      }),
    ).toBeNull();
  });

  it("reports required field missing", () => {
    const err = validate({
      p_fecha: "2026-03-01T09:00:00-03:00",
      p_litros: "45.9",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("p_patente");
  });

  it("rejects empty string for required numeric rather than coercing to 0", () => {
    const err = validate({
      p_patente: "TRCG73",
      p_fecha: "2026-03-01T09:00:00-03:00",
      p_litros: "",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("p_litros");
  });

  it("rejects non-ISO date-time on required timestamp", () => {
    const err = validate({
      p_patente: "TRCG73",
      p_fecha: "March 1, 2026",
      p_litros: "45.9",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("p_fecha");
  });

  it("rejects non-numeric litros", () => {
    const err = validate({
      p_patente: "TRCG73",
      p_fecha: "2026-03-01T09:00:00-03:00",
      p_litros: "abc",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("p_litros");
  });

  it("allows empty string for optional fields", () => {
    expect(
      validate({
        p_patente: "TRCG73",
        p_fecha: "2026-03-01T09:00:00-03:00",
        p_litros: "45.9",
        p_odometro: "",
        p_monto: "",
      }),
    ).toBeNull();
  });

  it("passes through unknown columns (_duplicateStrategy, notes, etc.)", () => {
    expect(
      validate({
        p_patente: "TRCG73",
        p_fecha: "2026-03-01T09:00:00-03:00",
        p_litros: "45.9",
        notes: "manual entry",
        _duplicateStrategy: "upsert",
      }),
    ).toBeNull();
  });

  it("enforces enum", () => {
    const params: IntrospectedParam[] = [
      {
        name: "status",
        type: "string",
        format: "text",
        required: true,
        enum: ["ok", "skip"],
      },
    ];
    expect(validate({ status: "ok" }, params)).toBeNull();
    const err = validate({ status: "maybe" }, params);
    expect(err).not.toBeNull();
    expect(err).toContain("status");
  });

  it("enforces numeric bounds", () => {
    const params: IntrospectedParam[] = [
      {
        name: "score",
        type: "integer",
        format: "int4",
        required: true,
        minimum: 0,
        maximum: 100,
      },
    ];
    expect(validate({ score: "50" }, params)).toBeNull();
    expect(validate({ score: "150" }, params)).not.toBeNull();
    expect(validate({ score: "-1" }, params)).not.toBeNull();
  });

  it("degenerates to passthrough when no params are known", () => {
    expect(validate({ anything: "goes" }, [])).toBeNull();
  });
});

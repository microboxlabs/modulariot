import { describe, expect, it } from "vitest";
import {
  completeVariable,
  matchingVariables,
  openVariable,
} from "./variable-suggest";

const VARS = [
  { name: "patente", label: "Patente del camión", type: "string" },
  { name: "conductor", label: "Nombre del conductor", type: "string" },
  { name: "transportista", label: "Empresa transportista", type: "string" },
];

describe("openVariable", () => {
  it("finds the {{ the caret is in, with what was typed after it", () => {
    expect(openVariable("Hola {{pa", 9)).toEqual({ from: 5, query: "pa" });
    expect(openVariable("Hola {{", 7)).toEqual({ from: 5, query: "" });
  });

  it("is null outside a variable or after a closed one", () => {
    expect(openVariable("Hola pa", 7)).toBeNull();
    expect(openVariable("{{patente}} va", 14)).toBeNull();
  });
});

describe("matchingVariables", () => {
  it("puts names that start with the query before labels that contain it", () => {
    expect(matchingVariables(VARS, "con").map((v) => v.name)).toEqual([
      "conductor",
    ]);
    expect(matchingVariables(VARS, "camión").map((v) => v.name)).toEqual([
      "patente",
    ]);
    expect(matchingVariables(VARS, "")).toHaveLength(3);
  });
});

describe("completeVariable", () => {
  it("writes the whole variable and puts the caret after it", () => {
    expect(
      completeVariable("Hola {{pa va", { from: 5, query: "pa" }, 9, "patente")
    ).toEqual({ value: "Hola {{patente}} va", caret: 16 });
  });

  it("reuses a closing }} already there", () => {
    expect(
      completeVariable("Hola {{pa}} va", { from: 5, query: "pa" }, 9, "patente")
    ).toEqual({ value: "Hola {{patente}} va", caret: 16 });
  });
});

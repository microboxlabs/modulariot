import { describe, it, expect } from "vitest";
import {
  isOriginTaskDriven,
  parseTaskDrivenOrigins,
} from "./task-driven-origin";

describe("parseTaskDrivenOrigins", () => {
  it("returns an empty set for undefined / null / empty input", () => {
    expect(parseTaskDrivenOrigins(undefined).size).toBe(0);
    expect(parseTaskDrivenOrigins(null).size).toBe(0);
    expect(parseTaskDrivenOrigins("").size).toBe(0);
  });

  it("splits on commas and trims whitespace around entries", () => {
    const set = parseTaskDrivenOrigins(" ANTOFAGASTA , CALAMA ");
    expect(set.has("ANTOFAGASTA")).toBe(true);
    expect(set.has("CALAMA")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("drops empty entries (trailing comma, double comma)", () => {
    const set = parseTaskDrivenOrigins("ANTOFAGASTA,,CALAMA,");
    expect(set.size).toBe(2);
    expect(set.has("")).toBe(false);
  });

  it("returns an empty set when input is only commas / whitespace", () => {
    expect(parseTaskDrivenOrigins("  ,  ,   ").size).toBe(0);
  });
});

describe("isOriginTaskDriven", () => {
  it("returns true for an origin in the enabled set", () => {
    const enabled = new Set(["ANTOFAGASTA", "CALAMA"]);
    expect(isOriginTaskDriven("ANTOFAGASTA", enabled)).toBe(true);
    expect(isOriginTaskDriven("CALAMA", enabled)).toBe(true);
  });

  it("returns false for an origin outside the enabled set", () => {
    const enabled = new Set(["ANTOFAGASTA"]);
    expect(isOriginTaskDriven("CALAMA", enabled)).toBe(false);
    expect(isOriginTaskDriven("DOES_NOT_EXIST", enabled)).toBe(false);
  });

  it("returns false for an empty enabled set (default off)", () => {
    expect(isOriginTaskDriven("ANTOFAGASTA", new Set())).toBe(false);
  });

  it("returns false when origin argument is undefined or empty", () => {
    const enabled = new Set(["ANTOFAGASTA"]);
    expect(isOriginTaskDriven(undefined, enabled)).toBe(false);
    expect(isOriginTaskDriven("", enabled)).toBe(false);
  });

  it("is case-sensitive on the origin match", () => {
    const enabled = new Set(["ANTOFAGASTA"]);
    expect(isOriginTaskDriven("antofagasta", enabled)).toBe(false);
    expect(isOriginTaskDriven("Antofagasta", enabled)).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOriginTaskDriven } from "./task-driven-origin";

const ENV_KEY = "NEXT_PUBLIC_TASK_DRIVEN_ORIGINS";

describe("isOriginTaskDriven", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("returns true for an origin listed in the env var", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA,CALAMA";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(true);
    expect(isOriginTaskDriven("CALAMA")).toBe(true);
  });

  it("returns false for an origin not in the env list", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(isOriginTaskDriven("CALAMA")).toBe(false);
  });

  it("returns false for an unknown / unrecognised origin code", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(isOriginTaskDriven("DOES_NOT_EXIST")).toBe(false);
  });

  it("returns false when the env var is unset (default off)", () => {
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(false);
  });

  it("returns false when the env var is empty (default off)", () => {
    process.env[ENV_KEY] = "";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(false);
  });

  it("returns false when the origin argument is undefined", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(isOriginTaskDriven(undefined)).toBe(false);
  });

  it("returns false when the origin argument is an empty string", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA,";
    expect(isOriginTaskDriven("")).toBe(false);
  });

  it("trims whitespace around entries", () => {
    process.env[ENV_KEY] = " ANTOFAGASTA , CALAMA ";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(true);
    expect(isOriginTaskDriven("CALAMA")).toBe(true);
  });

  it("ignores empty entries (trailing comma, double comma)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA,,CALAMA,";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(true);
    expect(isOriginTaskDriven("CALAMA")).toBe(true);
    expect(isOriginTaskDriven("")).toBe(false);
  });

  it("returns false when the env var contains only whitespace / commas", () => {
    process.env[ENV_KEY] = "  ,  ,   ";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(false);
  });

  it("is case-sensitive on the origin match", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(isOriginTaskDriven("antofagasta")).toBe(false);
    expect(isOriginTaskDriven("Antofagasta")).toBe(false);
  });

  it("picks up env changes between calls (no module-level caching)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(true);
    process.env[ENV_KEY] = "CALAMA";
    expect(isOriginTaskDriven("ANTOFAGASTA")).toBe(false);
    expect(isOriginTaskDriven("CALAMA")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import {
  engineOffLabel,
  frameEngineStatus,
  isEngineOffFrame,
  isEngineOffValue,
  newestEngineOff,
} from "./engine-state";

describe("isEngineOffValue", () => {
  it.each([false, 0, "0", "false", "FALSE", " off "])("%j is off", (v) => {
    expect(isEngineOffValue(v)).toBe(true);
  });

  it.each([true, 1, "1", "true", "on", "", null, undefined, {}])(
    "%j is not off",
    (v) => {
      expect(isEngineOffValue(v)).toBe(false);
    }
  );
});

describe("isEngineOffFrame", () => {
  it("reads sensors.engine_status first, then engine_status", () => {
    expect(isEngineOffFrame({ sensors: { engine_status: false } })).toBe(true);
    expect(
      isEngineOffFrame({ sensors: { engine_status: true }, engine_status: "0" })
    ).toBe(false);
    expect(
      isEngineOffFrame({ sensors: { engine_status: null }, engine_status: "0" })
    ).toBe(true);
    expect(isEngineOffFrame({ engine_status: "false" })).toBe(true);
  });

  it("treats a missing engine status as unknown, not off", () => {
    expect(isEngineOffFrame({})).toBe(false);
    expect(isEngineOffFrame({ sensors: null })).toBe(false);
    expect(isEngineOffFrame(undefined)).toBe(false);
    expect(frameEngineStatus({})).toBeNull();
  });
});

describe("newestEngineOff", () => {
  it("uses the frame's status before the case's reported status", () => {
    expect(newestEngineOff({ engine_status: true }, false)).toBe(false);
    expect(newestEngineOff({ engine_status: false }, true)).toBe(true);
  });

  it("falls back to the reported status when the frame has none", () => {
    expect(newestEngineOff({}, false)).toBe(true);
    expect(newestEngineOff({}, true)).toBe(false);
    expect(newestEngineOff({}, undefined)).toBe(false);
    expect(newestEngineOff(undefined, false)).toBe(false);
  });
});

describe("engineOffLabel", () => {
  it("says the engine is off in Spanish and English", () => {
    expect(engineOffLabel(true, false, es)).toBe("Motor apagado");
    expect(engineOffLabel(true, false, en)).toBe("Engine off");
  });

  it("gives way to lost signal and says nothing while the engine is not off", () => {
    expect(engineOffLabel(true, true, es)).toBeNull();
    expect(engineOffLabel(false, false, es)).toBeNull();
  });
});

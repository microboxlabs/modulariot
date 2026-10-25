import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTICS_ENDPOINT,
  errorToFields,
  maskRut,
  totemEvent,
  withTimeout,
} from "./totem-diagnostics";

describe("maskRut", () => {
  it("keeps only the last four characters", () => {
    expect(maskRut("20461337-0")).toBe("*****3370");
    expect(maskRut("1-9")).toBe("**");
    expect(maskRut(undefined)).toBe("");
  });
});

describe("errorToFields", () => {
  it("extracts code, status and erc from decorated errors", () => {
    const err = Object.assign(new Error("boom"), { code: "TIMEOUT", status: 504, erc: 7 });
    expect(errorToFields(err)).toEqual({ message: "boom", code: "TIMEOUT", status: 504, erc: 7 });
  });
  it("stringifies non-errors", () => {
    expect(errorToFields("x")).toEqual({ message: "x" });
  });
});

describe("totemEvent", () => {
  const fetchMock = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    window.history.replaceState({}, "", "/app/es/totem?deviceLocation=SCL&deviceId=k1");
    window.__totemDiagnostics = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("masks the rut, adds device context, remembers and ships the record", () => {
    const record = totemEvent("idcard.error", { rut: "20461337-0", status: 504, code: "TIMEOUT" });
    expect(record).toMatchObject({
      event: "idcard.error",
      rut: "*****3370",
      deviceLocation: "SCL",
      deviceId: "k1",
      status: 504,
    });
    expect(window.__totemDiagnostics).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      DIAGNOSTICS_ENDPOINT,
      expect.objectContaining({ method: "POST", keepalive: true })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toContain("20461337");
    expect(console.warn).toHaveBeenCalled();
  });

  it("never throws when fetch is unavailable", () => {
    vi.stubGlobal("fetch", undefined);
    expect(() => totemEvent("deps.loaded")).not.toThrow();
  });
});

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rejects with the provided error after the delay", async () => {
    const pending = new Promise<never>(() => undefined);
    const outcome = expect(
      withTimeout(pending, 100, () => new Error("late"))
    ).rejects.toThrow("late");
    await vi.advanceTimersByTimeAsync(100);
    await outcome;
  });

  it("passes the value through when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve(1), 100, () => new Error("late"))).resolves.toBe(1);
  });
});

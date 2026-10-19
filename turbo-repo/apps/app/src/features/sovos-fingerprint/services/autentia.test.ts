import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutentiaError, validateRut } from "./autentia";
import type { AutentiaTypeCallback } from "./autentia.types";

type Captured = {
  token: string | number;
  callback: AutentiaTypeCallback;
  path: string;
  inputs: Record<string, string>;
};

let captured: Captured | null;

function installPlugin(behaviour?: (c: Captured) => void) {
  captured = null;
  window.plgAutentiaJS = class {
    Transaccion2(
      path: string,
      inputs: Record<string, string>,
      _outputs: string[],
      _focus: boolean,
      token: string | number,
      callback: AutentiaTypeCallback
    ) {
      captured = { token, callback, path, inputs };
      behaviour?.(captured);
    }
  };
}

describe("validateRut (legacy Autentia plugin wrapper)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error test cleanup
    delete window.plgAutentiaJS;
  });

  it("resolves ParamsGet when Erc is 0 and the token matches", async () => {
    installPlugin();
    const promise = validateRut("11111111-1", { autentiaPath: "x/verifica" });
    captured!.callback({
      ParamsGet: { Erc: 0, ercText: "", Rut: "11111111-1", NroAudit: "A-1" },
      token: String(captured!.token),
    });
    await expect(promise).resolves.toMatchObject({ Erc: 0, NroAudit: "A-1" });
    expect(captured!.path).toBe("x/verifica");
    expect(captured!.inputs).toEqual({ Rut: "11111111-1" });
  });

  it("accepts a token echoed with a decimal comma", async () => {
    installPlugin();
    const promise = validateRut("1-9");
    captured!.callback({
      ParamsGet: { Erc: 0, ercText: "", Rut: "1-9" },
      token: `${captured!.token},0`,
    });
    await expect(promise).resolves.toBeTruthy();
  });

  it("rejects with the plugin's ercText and Erc when the transaction fails", async () => {
    installPlugin();
    const promise = validateRut("1-9");
    captured!.callback({
      ParamsGet: { Erc: 12, ercText: "Huella no coincide", Rut: "1-9" },
      token: String(captured!.token),
    });
    await expect(promise).rejects.toMatchObject({
      name: "AutentiaError",
      code: "TRANSACTION_FAILED",
      erc: 12,
      ercText: "Huella no coincide",
      message: "Huella no coincide",
    });
  });

  it("rejects the plugin's own transport error (no Erc, lowercase ercText)", async () => {
    installPlugin();
    const promise = validateRut("1-9");
    captured!.callback({
      ParamsGet: {
        ercText: "Error de comunicacion con la componente Autentia.",
      } as never,
    });
    await expect(promise).rejects.toMatchObject({
      code: "TRANSACTION_FAILED",
      message: "Error de comunicacion con la componente Autentia.",
    });
  });

  it("rejects instead of hanging when the echoed token belongs to another transaction", async () => {
    installPlugin();
    const promise = validateRut("1-9");
    captured!.callback({
      ParamsGet: { Erc: 0, ercText: "", Rut: "1-9" },
      token: "123",
    });
    await expect(promise).rejects.toMatchObject({ code: "TOKEN_MISMATCH" });
  });

  it("rejects with TIMEOUT when the plugin never calls back", async () => {
    installPlugin();
    const promise = validateRut("1-9", { timeoutMs: 5_000 });
    const outcome = expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(5_000);
    await outcome;
  });

  it("settles once: a late callback after the timeout is ignored", async () => {
    installPlugin();
    const promise = validateRut("1-9", { timeoutMs: 1_000 });
    const outcome = expect(promise).rejects.toBeInstanceOf(AutentiaError);
    await vi.advanceTimersByTimeAsync(1_000);
    await outcome;
    expect(() =>
      captured!.callback({
        ParamsGet: { Erc: 0, ercText: "", Rut: "1-9" },
        token: String(captured!.token),
      })
    ).not.toThrow();
  });

  it("rejects with PLUGIN_NOT_LOADED when the legacy scripts are missing", async () => {
    await expect(validateRut("1-9")).rejects.toMatchObject({
      code: "PLUGIN_NOT_LOADED",
    });
  });

  it("rejects with PLUGIN_THREW when the plugin throws synchronously", async () => {
    installPlugin(() => {
      throw new Error("jQuery is not defined");
    });
    await expect(validateRut("1-9")).rejects.toMatchObject({
      code: "PLUGIN_THREW",
      message: "jQuery is not defined",
    });
  });
});

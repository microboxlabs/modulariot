import { AutentiaParamsGet, CallbackParams } from "./autentia.types";
import { randomToken } from "@/features/totem/diagnostics/totem-diagnostics";

const defaultOutputs = [
  "Erc",
  "NroAudit",
  "ErcDesc",
  "oNombres",
  "oSexo",
  "oFchNac",
];

export const DEFAULT_AUTENTIA_TIMEOUT_MS = 120_000;

export type AutentiaErrorCode =
  | "PLUGIN_NOT_LOADED"
  | "PLUGIN_THREW"
  | "TRANSACTION_FAILED"
  | "TOKEN_MISMATCH"
  | "INVALID_RESPONSE"
  | "SIGNATURE_INVALID"
  | "AGENT_UNREACHABLE"
  | "TIMEOUT";

export class AutentiaError extends Error {
  code: AutentiaErrorCode;
  status: number;
  erc?: number;
  ercText?: string;
  ercDesc?: string;

  constructor(
    code: AutentiaErrorCode,
    message: string,
    extra: { erc?: number; ercText?: string; ercDesc?: string } = {}
  ) {
    super(message);
    this.name = "AutentiaError";
    this.code = code;
    this.status = code === "TRANSACTION_FAILED" ? (extra.erc ?? 500) : 500;
    this.erc = extra.erc;
    this.ercText = extra.ercText;
    this.ercDesc = extra.ercDesc;
  }
}

export type ValidateRutOptions = {
  timeoutMs?: number;
  autentiaPath?: string;
};

function readErc(params: Partial<AutentiaParamsGet> | undefined): number | undefined {
  const raw = params?.Erc ?? (params as { erc?: unknown } | undefined)?.erc;
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isNaN(n) ? undefined : n;
}

function readErcText(params: Partial<AutentiaParamsGet> | undefined): string {
  return (
    params?.ercText ??
    (params as { ErcText?: string } | undefined)?.ErcText ??
    (params as { ErcDesc?: string } | undefined)?.ErcDesc ??
    ""
  );
}

function tokenMatches(expected: number, received: unknown): boolean {
  if (typeof received === "number") return received === expected;
  if (typeof received !== "string") return false;
  return parseFloat(received.replace(",", ".")) === expected;
}

function unblockPluginOverlay() {
  const jq = (window as Window & { jQuery?: { unblockUI?: () => void } })
    .jQuery;
  try {
    jq?.unblockUI?.();
  } catch {
    // The overlay belongs to the legacy plugin; failing to remove it is not fatal.
  }
}

function envTimeout(): number {
  const raw = process.env.NEXT_PUBLIC_AUTENTIA_TIMEOUT_MS;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AUTENTIA_TIMEOUT_MS;
}

/**
 * Runs the fingerprint transaction through the legacy Autentia plugin.
 * Settles exactly once: on plugin callback, on timeout, or on plugin exception.
 */
export function validateRut(
  Rut: string,
  options: ValidateRutOptions = {}
): Promise<AutentiaParamsGet> {
  const timeoutMs = options.timeoutMs ?? envTimeout();
  const autentiaPath =
    options.autentiaPath ?? process.env.NEXT_PUBLIC_AUTENTIA_PATH ?? "";
  const giveFocusToAutentia = true;
  const token = randomToken();

  return new Promise<AutentiaParamsGet>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      fn();
    };

    if (typeof window === "undefined" || typeof window.plgAutentiaJS !== "function") {
      finish(() =>
        reject(
          new AutentiaError(
            "PLUGIN_NOT_LOADED",
            "Autentia plugin is not loaded in this page"
          )
        )
      );
      return;
    }

    timer = setTimeout(() => {
      unblockPluginOverlay();
      finish(() =>
        reject(
          new AutentiaError(
            "TIMEOUT",
            `Autentia plugin did not answer within ${timeoutMs}ms`
          )
        )
      );
    }, timeoutMs);

    const onResult = (result: CallbackParams) => {
      const params = result?.ParamsGet;
      const fatal = (result as { error?: unknown } | undefined)?.error;
      if (fatal) {
        finish(() =>
          reject(
            new AutentiaError("INVALID_RESPONSE", String(fatal), {
              ercText: readErcText(params),
            })
          )
        );
        return;
      }
      if (!params) {
        finish(() =>
          reject(
            new AutentiaError(
              "INVALID_RESPONSE",
              "Autentia plugin answered without ParamsGet"
            )
          )
        );
        return;
      }
      const erc = readErc(params);
      if (erc !== 0) {
        const ercText = readErcText(params);
        finish(() =>
          reject(
            new AutentiaError(
              "TRANSACTION_FAILED",
              ercText || `rut validation failed (Erc=${erc ?? "missing"})`,
              { erc, ercText, ercDesc: params.ErcDesc }
            )
          )
        );
        return;
      }
      if (!tokenMatches(token, result.token)) {
        finish(() =>
          reject(
            new AutentiaError(
              "TOKEN_MISMATCH",
              "Autentia plugin answered with a token from another transaction"
            )
          )
        );
        return;
      }
      finish(() => resolve(params));
    };

    try {
      const Autentia = new window.plgAutentiaJS();
      Autentia.Transaccion2(
        autentiaPath,
        { Rut },
        defaultOutputs,
        giveFocusToAutentia,
        token,
        onResult
      );
    } catch (error) {
      unblockPluginOverlay();
      finish(() =>
        reject(
          new AutentiaError(
            "PLUGIN_THREW",
            error instanceof Error ? error.message : String(error)
          )
        )
      );
    }
  });
}

export function fakeValidateRut(_pRut: string): Promise<AutentiaParamsGet> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        Erc: 0,
        ercText: "",
        NroAudit: "SMIN-M1KG-BYBF-JJD4",
        Rut: "",
      });
    }, 2000);
  });
}

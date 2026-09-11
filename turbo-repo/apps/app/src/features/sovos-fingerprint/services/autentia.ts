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

/** Text from a plugin field that may be a string, a number, or absent. */
export function fieldText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

/** The plugin returns `Erc` on success paths and `erc` on its own error paths. */
export function readErc(params: Record<string, unknown> | undefined): number | undefined {
  const raw = params?.Erc ?? params?.erc;
  if (typeof raw === "number") return Number.isNaN(raw) ? undefined : raw;
  if (typeof raw !== "string") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function readErcText(params: Record<string, unknown> | undefined): string {
  return (
    fieldText(params?.ercText) ||
    fieldText(params?.ErcText) ||
    fieldText(params?.ErcDesc)
  );
}

export function tokenMatches(expected: number, received: unknown): boolean {
  if (typeof received === "number") return received === expected;
  if (typeof received !== "string") return false;
  return Number.parseFloat(received.replace(",", ".")) === expected;
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
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
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
      const params = result?.ParamsGet as Record<string, unknown> | undefined;
      const fatal = (result as { error?: unknown } | undefined)?.error;
      if (fatal) {
        finish(() =>
          reject(
            new AutentiaError(
              "INVALID_RESPONSE",
              fieldText(fatal) || "Autentia plugin reported a fatal error",
              { ercText: readErcText(params) }
            )
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
              { erc, ercText, ercDesc: fieldText(params.ErcDesc) || undefined }
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
      finish(() => resolve(params as unknown as AutentiaParamsGet));
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

export const TOTEM_DIAGNOSTIC_EVENTS = [
  "deps.loaded",
  "deps.failed",
  "step.change",
  "fingerprint.start",
  "fingerprint.ok",
  "fingerprint.error",
  "idcard.start",
  "idcard.ok",
  "idcard.error",
  "biometric.start",
  "biometric.ok",
  "biometric.error",
] as const;

export type TotemDiagnosticEvent = (typeof TOTEM_DIAGNOSTIC_EVENTS)[number];

export type TotemDiagnosticFields = {
  rut?: string;
  step?: number;
  durationMs?: number;
  code?: string;
  status?: number;
  erc?: number;
  message?: string;
};

export type TotemDiagnosticRecord = TotemDiagnosticFields & {
  event: TotemDiagnosticEvent;
  sessionId: string;
  deviceId: string;
  deviceLocation: string;
  at: string;
};

export const DIAGNOSTICS_ENDPOINT = "/app/api/totem/diagnostics";
const HISTORY_SIZE = 50;
const MESSAGE_MAX = 300;

declare global {
  interface Window {
    __totemDiagnostics?: TotemDiagnosticRecord[];
  }
}

let sessionId: string | null = null;

/** Keeps the last four characters so a case can be matched without logging the full RUT. */
export function maskRut(rut: string | null | undefined): string {
  if (!rut) return "";
  const clean = rut.replace(/[^0-9kK]/g, "");
  if (clean.length <= 4) return "*".repeat(clean.length);
  return "*".repeat(clean.length - 4) + clean.slice(-4);
}

export function errorToFields(err: unknown): TotemDiagnosticFields {
  if (!(err instanceof Error)) {
    return { message: String(err).slice(0, MESSAGE_MAX) };
  }
  const e = err as Error & {
    code?: string;
    status?: number;
    erc?: number;
  };
  return {
    message: e.message.slice(0, MESSAGE_MAX),
    code: typeof e.code === "string" ? e.code : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
    erc: typeof e.erc === "number" ? e.erc : undefined,
  };
}

function getSessionId(): string {
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2, 10);
  }
  return sessionId;
}

function getDeviceContext(): { deviceId: string; deviceLocation: string } {
  if (typeof window === "undefined") {
    return { deviceId: "unknown", deviceLocation: "unknown" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    deviceId: params.get("deviceId") ?? "unknown",
    deviceLocation: params.get("deviceLocation") ?? "unknown",
  };
}

function remember(record: TotemDiagnosticRecord) {
  if (typeof window === "undefined") return;
  const history = (window.__totemDiagnostics ??= []);
  history.push(record);
  if (history.length > HISTORY_SIZE) history.shift();
}

function ship(record: TotemDiagnosticRecord) {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  try {
    void fetch(DIAGNOSTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Diagnostics never break the flow they observe.
  }
}

/**
 * Records a totem event in the browser console, in `window.__totemDiagnostics`,
 * and in the server log through the diagnostics endpoint.
 */
export function totemEvent(
  event: TotemDiagnosticEvent,
  fields: TotemDiagnosticFields = {}
): TotemDiagnosticRecord {
  const record: TotemDiagnosticRecord = {
    ...fields,
    rut: fields.rut !== undefined ? maskRut(fields.rut) : undefined,
    message: fields.message?.slice(0, MESSAGE_MAX),
    event,
    sessionId: getSessionId(),
    ...getDeviceContext(),
    at: new Date().toISOString(),
  };
  const isFailure = event.endsWith(".error") || event.endsWith(".failed");
  if (typeof console !== "undefined") {
    (isFailure ? console.warn : console.info)("[totem]", event, record);
  }
  remember(record);
  ship(record);
  return record;
}

/** Rejects with `onTimeout()` when `promise` has not settled after `ms`. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

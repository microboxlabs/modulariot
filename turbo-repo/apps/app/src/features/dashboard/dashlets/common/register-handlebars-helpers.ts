import Handlebars from "handlebars";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOCALE = "es-CL";
const DEFAULT_TIMEZONE = "America/Santiago";
const FALLBACK = "-";

// ============================================================================
// Internal utilities
// ============================================================================

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ============================================================================
// Number helpers
// ============================================================================

export function formatNumberHelper(
  this: unknown,
  value: unknown,
  options: Handlebars.HelperOptions
): string {
  const n = toNumber(value);
  if (n === null) return FALLBACK;

  const hash = options?.hash ?? {};
  const locale: string = hash.locale ?? DEFAULT_LOCALE;
  const decimals: number | undefined =
    hash.decimals === undefined ? undefined : Number(hash.decimals);
  const prefix: string = hash.prefix ?? "";
  const suffix: string = hash.suffix ?? "";

  const formatOptions: Intl.NumberFormatOptions = {};
  if (decimals !== undefined) {
    formatOptions.minimumFractionDigits = decimals;
    formatOptions.maximumFractionDigits = decimals;
  }

  const formatted = new Intl.NumberFormat(locale, formatOptions).format(n);
  return `${prefix}${formatted}${suffix}`;
}

export function extractNumberHelper(value: unknown): string {
  if (value === null || value === undefined) return FALLBACK;
  if (typeof value === "object") return FALLBACK;
  const str = `${value as string | number | boolean}`;
  const match = /[-+]?\d+([.,]\d+)?/.exec(str);
  return match ? match[0] : FALLBACK;
}

export function toFixedHelper(value: unknown, decimals: unknown): string {
  const n = toNumber(value);
  if (n === null) return FALLBACK;
  const d = toNumber(decimals);
  return n.toFixed(d ?? 0);
}

export function roundHelper(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return FALLBACK;
  return String(Math.round(n));
}

export function multiplyHelper(value: unknown, factor: unknown): string {
  const n = toNumber(value);
  const f = toNumber(factor);
  if (n === null || f === null) return FALLBACK;
  return String(n * f);
}

export function divideHelper(value: unknown, divisor: unknown): string {
  const n = toNumber(value);
  const d = toNumber(divisor);
  if (n === null || d === null || d === 0) return FALLBACK;
  return String(n / d);
}

// ============================================================================
// Date helpers
// ============================================================================

export function formatDateHelper(
  this: unknown,
  value: unknown,
  options: Handlebars.HelperOptions
): string {
  const d = toDate(value);
  if (!d) return FALLBACK;

  const hash = options?.hash ?? {};
  const format: string = hash.format ?? "datetime";
  const locale: string = hash.locale ?? DEFAULT_LOCALE;
  const timeZone: string = hash.timezone ?? DEFAULT_TIMEZONE;

  switch (format) {
    case "date":
      return d.toLocaleDateString(locale, {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    case "time":
      return d.toLocaleTimeString(locale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    case "relative": {
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(Math.abs(diffMs) / 60_000);
      if (diffMin < 1) return "now";
      if (diffMin < 60) return `${diffMin}m`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD}d`;
      return d.toLocaleDateString(locale, {
        timeZone,
        month: "short",
        day: "numeric",
      });
    }

    case "datetime":
    default:
      return d.toLocaleString(locale, {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
  }
}

export function datePartHelper(value: unknown, part: unknown): string {
  const d = toDate(value);
  if (!d) return FALLBACK;

  const p = String(part).toLowerCase();
  const tz = DEFAULT_TIMEZONE;
  const locale = DEFAULT_LOCALE;

  switch (p) {
    case "year":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        year: "numeric",
      }).format(d);
    case "month":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        month: "2-digit",
      }).format(d);
    case "day":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        day: "2-digit",
      }).format(d);
    case "hour":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
      }).format(d);
    case "minute":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        minute: "2-digit",
      }).format(d);
    case "weekday":
      return new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        weekday: "long",
      }).format(d);
    default:
      return FALLBACK;
  }
}

export function timeAgoHelper(value: unknown): string {
  const d = toDate(value);
  if (!d) return FALLBACK;

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(Math.abs(diffMs) / 60_000);
  const suffix = diffMs >= 0 ? "ago" : "from now";

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ${suffix}`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ${suffix}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ${suffix}`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `${diffMo}mo ${suffix}`;
  const diffY = Math.floor(diffD / 365);
  return `${diffY}y ${suffix}`;
}

// ============================================================================
// Registration
// ============================================================================

let registered = false;

export function registerHandlebarsHelpers(): void {
  if (registered) return;
  registered = true;

  Handlebars.registerHelper("formatNumber", formatNumberHelper);
  Handlebars.registerHelper("extractNumber", extractNumberHelper);
  Handlebars.registerHelper("toFixed", toFixedHelper);
  Handlebars.registerHelper("round", roundHelper);
  Handlebars.registerHelper("multiply", multiplyHelper);
  Handlebars.registerHelper("divide", divideHelper);
  Handlebars.registerHelper("formatDate", formatDateHelper);
  Handlebars.registerHelper("datePart", datePartHelper);
  Handlebars.registerHelper("timeAgo", timeAgoHelper);
}

// Auto-register on import
registerHandlebarsHelpers();

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

/** The level names the maintainer uses (Bajo observación … Código negro). */
export function levelName(icu: number, d: I18nRecord) {
  return trDynamic(`level${icu}`, d);
}

/** The shorter name used in "☎ Operador en …" tags. */
export function levelShortName(icu: number, d: I18nRecord) {
  return trDynamic(`levelShort${icu}`, d);
}

export function locale(lang: string) {
  return lang === "en" ? "en-US" : "es-CL";
}

export function fmt(n: number, lang: string) {
  return Number(n).toLocaleString(locale(lang));
}

/** 13 500 → "13,5 mil" (es) / "13.5k" (en). */
export function fmtK(n: number, lang: string, d: I18nRecord) {
  if (n < 1000) return String(n);
  const k = (n / 1000).toLocaleString(locale(lang), {
    maximumFractionDigits: 1,
  });
  return tr("thousands", d, { n: k });
}

/** "hace 7 días" from an ISO time, in the page's language. */
export function ago(iso: string | null | undefined, lang: string) {
  if (!iso) return "";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "minute");
}

export function shortDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(locale(lang), {
    day: "2-digit",
    month: "2-digit",
  });
}

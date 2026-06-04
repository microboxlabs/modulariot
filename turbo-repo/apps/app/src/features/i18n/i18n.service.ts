import "server-only";
import { I18nDictionries, I18nDictionary } from "./i18n.service.types";
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import { defaultLocale, locales, tr, trDynamic } from "./tr.service";
import type { TrKey } from "./tr.types";

const dictionaries: I18nDictionries<I18nDictionary> = {
  en: () => import("@/lang/en.json").then((m) => m.default),
  es: () => import("@/lang/es.json").then((m) => m.default),
};

export async function getDictionary(locale: string) {
  if (!locale || !dictionaries[locale]) {
    throw new Error(`Locale ${locale} not found`);
  }
  const dictionary = await dictionaries[locale]();
  const memoized = new Map<string, string>();
  return [
    function _tr(path: TrKey, params?: Record<string, string>): string {
      if (memoized.has(path)) {
        return memoized.get(path) ?? path;
      }
      const value = tr(path, dictionary, params);
      memoized.set(path, value);
      return value;
    },
    dictionary,
    // Escape hatch for runtime-built keys (not type-checked). Third tuple slot so
    // existing `const [, dict]` / `const [tr]` destructuring stays untouched.
    function _trDynamic(path: string, params?: Record<string, string>): string {
      // Cache by path AND params: the same dynamic key may be rendered with
      // different params (e.g. validation messages), so keying on path alone
      // would return a stale result. Serializing [path, params] as the key is
      // unambiguous and never collides with a bare-path key used by `_tr`.
      const cacheKey = JSON.stringify([path, params ?? {}]);
      if (memoized.has(cacheKey)) {
        return memoized.get(cacheKey) ?? path;
      }
      const value = trDynamic(path, dictionary, params);
      memoized.set(cacheKey, value);
      return value;
    },
  ] as [
    (path: TrKey, params?: Record<string, string>) => string,
    I18nDictionary,
    (path: string, params?: Record<string, string>) => string,
  ];
}

export function getLocaleFromHeaders(headers: Headers) {
  const plainHeaders = {
    "accept-language": headers.get("accept-language") ?? defaultLocale,
  };
  const languages = new Negotiator({ headers: plainHeaders }).languages();
  return match(languages, locales, defaultLocale);
}

export function getLocaleFromRequest(request: NextRequest) {
  return getLocaleFromHeaders(request.headers);
}

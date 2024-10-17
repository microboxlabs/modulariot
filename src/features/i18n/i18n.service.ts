import "server-only";
import { I18nDictionries, I18nRecord } from "./i18n.service.types";
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import { defaultLocale, locales, tr } from "./tr.service";

const dictionaries: I18nDictionries = {
  en: () => import("@/lang/en.json").then((m) => m.default as I18nRecord),
  es: () => import("@/lang/es.json").then((m) => m.default as I18nRecord),
};

export async function getDictionary(locale: string) {
  const localeDictionary = dictionaries[locale];
  if (!locale) {
    throw new Error(`Locale ${locale} not found`);
  }
  const dictionary = await localeDictionary();
  const memoized = new Map<string, string>();
  return [
    function _tr(path: string, params?: Record<string, string>): string {
      if (memoized.has(path)) {
        return memoized.get(path) ?? path;
      }
      const value = tr(path, dictionary, params);
      memoized.set(path, value);
      return value;
    },
    dictionary,
  ] as [(path: string, params?: Record<string, string>) => string, I18nRecord];
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

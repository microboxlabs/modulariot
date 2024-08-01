import "server-only";
import { I18nDictionries, I18nRecord } from "./i18n.service.types";
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import { tr } from "./tr.service";

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

export const locales = ["en", "es"];
export const defaultLocale = "es";

export function getLocaleFromHeaders(request: NextRequest) {
  const headers = {
    "accept-language": request.headers.get("accept-language") ?? defaultLocale,
  };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}

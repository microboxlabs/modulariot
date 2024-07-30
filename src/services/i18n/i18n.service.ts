import "server-only";
import { I18nDictionries, I18nRecord } from "./i18n.service.types";

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
  return function _tr(path: string, params?: Record<string, string>): string {
    if (memoized.has(path)) {
      return memoized.get(path) ?? path;
    }
    const value = tr(path, dictionary, params);
    memoized.set(path, value);
    return value;
  };
}

export function tr(
  path: string,
  dictionary: I18nRecord,
  params?: Record<string, string>,
): string {
  const keys = path.split(".");
  let value: any = dictionary;
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    value = value[key];
    if (!value) {
      return path;
    }
  }

  if (typeof value === "object") {
    return path;
  }

  return Object.entries(params ?? {}).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, value),
    value as string,
  );
}

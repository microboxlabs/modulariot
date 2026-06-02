import { I18nRecord } from "./i18n.service.types";
import type { LeafPaths } from "./tr.types";

/**
 * Valid keys for a given dictionary subtree. When `D` is the loose `I18nRecord`
 * index-signature type (a prop typed generically), `LeafPaths<D>` collapses to
 * `never`, so we fall back to `string` — that call site is simply unchecked
 * rather than rejected. Concretely-typed subtrees yield their real leaf paths.
 */
type DictKey<D> =
  LeafPaths<D> extends infer P ? ([P] extends [never] ? string : P) : never;

export const locales = ["en", "es"];
export const defaultLocale = "es";

function translate(
  path: string,
  dictionary: I18nRecord,
  params?: Record<string, string>
): string {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dictionary;
  for (const key of keys) {
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
    value as string
  );
}

/**
 * Translate a statically-known key. `path` is type-checked against the *exact
 * dictionary subtree passed in* (`dictionary`), so it works for both rooted
 * calls (`tr("pages.login.welcome", dict)`) and scoped calls
 * (`tr("title", dict.calendar.landing)`). A missing/renamed/typo'd key fails at
 * compile time instead of silently rendering the raw path at runtime.
 */
export function tr<D extends I18nRecord>(
  path: DictKey<D>,
  dictionary: D,
  params?: Record<string, string>
): string {
  return translate(path as string, dictionary, params);
}

/**
 * Escape hatch for keys built at runtime (interpolated or computed paths). The
 * path is NOT type-checked — reach for this only when the key genuinely cannot
 * be known statically. Prefer {@link tr} with a literal key everywhere else.
 */
export function trDynamic(
  path: string,
  dictionary: I18nRecord,
  params?: Record<string, string>
): string {
  return translate(path, dictionary, params);
}

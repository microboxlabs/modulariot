import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Translate } from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam A implementation: bridge the app's `tr` service onto the package's
 * injected-translate contract. Keys are resolved against the given dictionary
 * subtree (typically `dict.dashboard`); missing keys echo the key, matching
 * `tr` semantics.
 */
export function createDictionaryTranslate(dictionary: I18nRecord): Translate {
  return (key, params) => tr(key, dictionary, params);
}

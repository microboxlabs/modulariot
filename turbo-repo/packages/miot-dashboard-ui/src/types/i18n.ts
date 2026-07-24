/**
 * i18n contract (Seam A).
 *
 * The package never imports a host i18n stack. Hosts inject a `Translate`
 * function; the package's own components call it through `useDashboardI18n()`.
 *
 * `I18nRecord` is a structural mirror of the host app's dictionary type —
 * TypeScript structural typing makes host dictionaries assignable without any
 * import coupling. It remains on `DashletSettingsProps.dictionary` until the
 * dashlet call sites migrate to the injected translate (P4+).
 */

export type I18nRecord = {
  [key: string]: I18nRecord | string;
};

/**
 * Host-injected translate function. Keys are dot-paths (e.g.
 * "dashboard.settings.title"); `params` interpolate `{name}` placeholders.
 * Implementations should return the key itself when no translation exists.
 */
export type Translate = (
  key: string,
  params?: Record<string, string>
) => string;

/** Default translate: echoes the key (useful fallback + test double). */
export const identityTranslate: Translate = (key) => key;

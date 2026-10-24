import { locales } from "@/features/i18n/tr.service";

/**
 * The platform as a scope: platform owners pick it in the organization switcher, and the
 * settings shared with organizations read and write the reserved `_platform` tenant.
 * See ~/.miot/docs/platform-as-scope-design.md.
 */
export const PLATFORM_SCOPE_SLUG = "_platform";

export const isPlatformScope = (slug: string | null | undefined) =>
  slug === PLATFORM_SCOPE_SLUG;

/** The settings that exist in the platform scope; everything else needs a real organization. */
export const PLATFORM_SCOPE_SETTINGS: readonly string[] = [
  "/users/settings/platform",
  "/users/settings/organizations",
  "/users/settings/symptoms",
  "/users/settings/communications",
  "/users/settings/credentials",
  "/users/settings/connections",
];

/**
 * Where switching into the platform scope goes from `pathname` (base path and language included):
 * null keeps the page, which the platform scope has, else that language's Plataforma settings.
 */
export function platformScopeLanding(pathname: string): string | null {
  const parts = pathname.split("/");
  const lang = parts.findIndex((part) => locales.includes(part));
  if (lang < 0) return null;
  const page = "/" + parts.slice(lang + 1).join("/");
  return isPlatformScopePage(page)
    ? null
    : parts.slice(0, lang + 1).join("/") + PLATFORM_SCOPE_SETTINGS[0];
}

/** Whether the page at `href` (no language) exists in the platform scope. */
export const isPlatformScopePage = (href: string) => {
  const page = href.split("?")[0];
  return PLATFORM_SCOPE_SETTINGS.some(
    (setting) => page === setting || page.startsWith(setting + "/")
  );
};

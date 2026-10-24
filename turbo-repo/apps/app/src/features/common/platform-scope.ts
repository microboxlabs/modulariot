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

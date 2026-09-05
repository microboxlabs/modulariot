/** Shape of `GET /branding/{domain}` on the modulith. */
export type DomainBrandingSummary = {
  domain: string;
  hasLogo: boolean;
  logoEtag: string | null;
  /** Whether a second logo is stored for dark backgrounds. */
  hasDarkLogo: boolean;
  logoDarkEtag: string | null;
  homeUrl: string | null;
};

export type DomainBranding = {
  /** Same-origin URL under the app's basePath — not a base64 data URL. */
  logoUrl: string;
  /**
   * The dark-background variant, or null when the domain ships one logo for
   * both grounds. Callers render both and let CSS choose, rather than reading
   * the theme, so the right one is in the first paint.
   */
  logoUrlDark: string | null;
  /** Where the navbar brand links to; null leaves the logo unlinked. */
  homeUrl: string | null;
};

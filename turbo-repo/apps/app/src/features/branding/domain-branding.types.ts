/** Shape of `GET /branding/{domain}` on the modulith. */
export type DomainBrandingSummary = {
  domain: string;
  hasLogo: boolean;
  logoEtag: string | null;
  homeUrl: string | null;
};

export type DomainBranding = {
  /** Same-origin URL under the app's basePath — not a base64 data URL. */
  logoUrl: string;
  /** Where the navbar brand links to; null leaves the logo unlinked. */
  homeUrl: string | null;
};

import "server-only";

import { isModulithConfigured, modulithHost } from "@/lib/modulith-host";
import { resolveRequestDomain } from "@/features/branding/request-domain";
import type {
  DomainBranding,
  DomainBrandingSummary,
} from "@/features/branding/domain-branding.types";

/** Short enough that the render is never held up by a slow modulith. */
const SUMMARY_TIMEOUT_MS = 3_000;
/**
 * Long enough to spare the modulith a call per server render, short enough
 * that a logo change appears without a redeploy.
 */
const SUMMARY_REVALIDATE_SECONDS = 60;

/**
 * Branding for the host this request arrived on, or null when the host has
 * none — in which case callers render the bundled ModularIoT logo.
 *
 * Replaces `getPublicOrgLogo()`, which read a single logo from the ECM and had
 * no notion of the host, so every deployment sharing an ECM repository showed
 * the same brand.
 */
export async function getDomainBranding(): Promise<DomainBranding | null> {
  const domain = await resolveRequestDomain();
  if (!domain || !isModulithConfigured()) return null;

  const summary = await fetchSummary(domain);
  if (!summary?.hasLogo) return null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const logoUrl = (etag: string | null, variant?: "dark") =>
    `${basePath}/api/branding/logo?v=${encodeURIComponent(etag ?? "")}` +
    (variant ? `&variant=${variant}` : "");

  return {
    logoUrl: logoUrl(summary.logoEtag),
    logoUrlDark: summary.hasDarkLogo ? logoUrl(summary.logoDarkEtag, "dark") : null,
    homeUrl: summary.homeUrl ?? null,
  };
}

async function fetchSummary(
  domain: string,
): Promise<DomainBrandingSummary | null> {
  try {
    const response = await fetch(
      `${modulithHost()}/branding/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: SUMMARY_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as DomainBrandingSummary;
  } catch {
    // A branded logo is not worth failing a page render for.
    return null;
  }
}

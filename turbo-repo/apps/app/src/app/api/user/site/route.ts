import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserSites,
  getSiteLogos,
  getSiteLogoContent,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDomainBranding } from "@/features/branding/domain-branding.service";
import type { UserSiteResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { handleApiError, unauthorizedResponse } from "@/app/api/utils/api-error-handler";

export async function GET() {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    // Get user's sites
    const sites = await getUserSites(session);

    // Per-domain logo, used when the site has no branding of its own. A domain
    // that ships only one logo uses it on both grounds, which is what this
    // fell back to for every domain before the dark variant existed.
    const branding = await getDomainBranding();
    const publicLogo = branding?.logoUrl ?? null;
    const publicLogoDark = branding?.logoUrlDark ?? publicLogo;

    if (!sites || sites.length === 0) {
      // Return public logo if available, otherwise null
      const response: UserSiteResponse = {
        site: null,
        logoUrlLight: publicLogo,
        logoUrlDark: publicLogoDark,
      };
      return NextResponse.json(response);
    }

    // Use the first site (primary site)
    const primarySite = sites[0];

    // Get theme-specific logos (light and dark variants) from site branding folder
    const logos = await getSiteLogos(session, primarySite.shortName);

    // Fetch logo content for both themes in parallel
    const [siteLogoLight, siteLogoDark] = await Promise.all([
      logos.light
        ? getSiteLogoContent(session, logos.light.nodeId, logos.light.mimeType)
        : null,
      logos.dark
        ? getSiteLogoContent(session, logos.dark.nodeId, logos.dark.mimeType)
        : null,
    ]);

    // Use site-specific logos if available, otherwise fall back to public org logo
    const response: UserSiteResponse = {
      site: primarySite,
      logoUrlLight: siteLogoLight ?? publicLogo,
      logoUrlDark: siteLogoDark ?? publicLogoDark,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "fetching user site");
  }
}

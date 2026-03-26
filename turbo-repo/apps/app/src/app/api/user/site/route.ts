import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserSites,
  getSiteLogos,
  getSiteLogoContent,
  getPublicOrgLogo,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
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

    // First, try to get the public organization logo
    const publicLogo = await getPublicOrgLogo();

    if (!sites || sites.length === 0) {
      // Return public logo if available, otherwise null
      const response: UserSiteResponse = {
        site: null,
        logoUrlLight: publicLogo,
        logoUrlDark: publicLogo,
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
      logoUrlDark: siteLogoDark ?? publicLogo,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "fetching user site");
  }
}

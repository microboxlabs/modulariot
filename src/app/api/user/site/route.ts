import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserSites,
  getSiteLogos,
  getSiteLogoContent,
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

    if (!sites || sites.length === 0) {
      const response: UserSiteResponse = {
        site: null,
        logoUrlLight: null,
        logoUrlDark: null,
      };
      return NextResponse.json(response);
    }

    // Use the first site (primary site)
    const primarySite = sites[0];

    // Get theme-specific logos (light and dark variants)
    const logos = await getSiteLogos(session, primarySite.shortName);

    // Fetch logo content for both themes in parallel
    const [logoUrlLight, logoUrlDark] = await Promise.all([
      logos.light
        ? getSiteLogoContent(session, logos.light.nodeId, logos.light.mimeType)
        : null,
      logos.dark
        ? getSiteLogoContent(session, logos.dark.nodeId, logos.dark.mimeType)
        : null,
    ]);

    const response: UserSiteResponse = {
      site: primarySite,
      logoUrlLight,
      logoUrlDark,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "fetching user site");
  }
}

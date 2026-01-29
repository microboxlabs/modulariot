import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserSites,
  getSiteLogoNodeId,
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
        logoUrl: null,
      };
      return NextResponse.json(response);
    }

    // Use the first site (primary site)
    const primarySite = sites[0];

    // Try to get the logo node (SVG first, then PNG)
    const logoNode = await getSiteLogoNodeId(session, primarySite.shortName);

    let logoUrl: string | null = null;
    if (logoNode) {
      // Get the logo content as base64 data URL
      logoUrl = await getSiteLogoContent(session, logoNode.nodeId, logoNode.mimeType);
    }

    const response: UserSiteResponse = {
      site: primarySite,
      logoUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "fetching user site");
  }
}

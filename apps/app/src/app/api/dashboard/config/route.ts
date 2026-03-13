import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDashboardConfig,
  saveDashboardConfig,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

/**
 * GET /api/dashboard/config?site={siteShortName}&slug={slug}
 *
 * Proxies to the Alfresco dashboard config webscript.
 * Returns { data: <parsed JSON> } or { data: null } if no config exists yet.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const site = searchParams.get("site");
  const slug = searchParams.get("slug");

  if (!site || !slug) {
    return badRequestResponse("Missing required query parameters: site, slug");
  }

  try {
    const result = await getDashboardConfig(session, site, slug);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "reading dashboard config from Alfresco");
  }
}

/**
 * PUT /api/dashboard/config
 *
 * Proxies to the Alfresco dashboard config webscript.
 * Body: { site: string, slug: string, config: DashboardStorageSchema }
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      site?: string;
      slug?: string;
      config?: unknown;
    };
    const { site, slug, config } = body;

    if (!site || !slug || !config) {
      return badRequestResponse(
        "Missing required fields: site, slug, config"
      );
    }

    const result = await saveDashboardConfig(session, site, slug, config);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "saving dashboard config to Alfresco");
  }
}

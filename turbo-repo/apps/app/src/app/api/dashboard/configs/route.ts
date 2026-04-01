import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDashboardConfigs } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

/**
 * GET /api/dashboard/configs?site={siteShortName}
 *
 * Lists all dashboard configs for a given site.
 * Alfresco returns { data: [{ slug, config }] }.
 * We transform to { data: [{ slug, name }] } for the client.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const site = searchParams.get("site")?.trim()?.trim();

  if (!site) {
    return badRequestResponse("Missing required query parameter: site");
  }

  try {
    const result = await listDashboardConfigs(session, site);

    // Transform { slug, config } → { slug, name } for the client
    const transformed = {
      data: (result.data ?? []).map((item) => {
        const rawName = item.config?.name;
        const name =
          typeof rawName === "string" && rawName.trim().length > 0
            ? rawName
            : item.slug;
        return { slug: item.slug, name };
      }),
    };

    return NextResponse.json(transformed);
  } catch (error) {
    return handleApiError(error, "listing dashboard configs from Alfresco");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listDashboardConfigs,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
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
    const [result, userGroups] = await Promise.all([
      listDashboardConfigs(session, site),
      getGroupsForPerson(session),
    ]);

    // Filter out dashboards the user is not allowed to access
    const accessible = (result.data ?? []).filter((item) => {
      const allowed = item.config?.allowedGroups;
      // No restriction: field is absent or empty array
      if (allowed === undefined || allowed === null) return true;
      if (!Array.isArray(allowed)) return false; // malformed — deny
      if (!allowed.every((g): g is string => typeof g === "string")) return false;
      if (allowed.length === 0) return true;
      return allowed.some((g) => userGroups.includes(g));
    });

    // Transform { slug, config } → { slug, name } for the client
    const transformed = {
      data: accessible.map((item) => {
        const rawName = item.config?.name;
        const name =
          typeof rawName === "string" && rawName.trim().length > 0
            ? rawName
            : item.slug;
        const order = typeof item.config?.order === "number" ? item.config.order : undefined;
        return { slug: item.slug, name, order };
      }),
    };

    return NextResponse.json(transformed);
  } catch (error) {
    return handleApiError(error, "listing dashboard configs from Alfresco");
  }
}

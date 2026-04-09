import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDashboardConfig,
  saveDashboardConfig,
  deleteDashboardConfig,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";
import type { DashboardStorageSchema } from "@/features/dashboard/types/dashboard.types";

function forbiddenResponse() {
  return NextResponse.json(
    { error: "You do not have access to this dashboard", status: 403 },
    { status: 403 }
  );
}

/**
 * Check whether a user has access to a dashboard based on its allowedGroups.
 * Returns true if the dashboard has no restrictions or the user is in at least one allowed group.
 */
async function hasAccessToDashboard(
  config: DashboardStorageSchema | null | undefined,
  session: Parameters<typeof getGroupsForPerson>[0]
): Promise<boolean> {
  if (!config) return true;
  const allowed = config.allowedGroups;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const userGroups = await getGroupsForPerson(session);
  return allowed.some((g) => userGroups.includes(g));
}

/**
 * GET /api/dashboard/config?site={siteShortName}&slug={slug}
 *
 * Proxies to the Alfresco dashboard config webscript (POST /dashboard-config/get).
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
    if (!(await hasAccessToDashboard(result.data as DashboardStorageSchema | null, session))) {
      return forbiddenResponse();
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "reading dashboard config from Alfresco");
  }
}

/**
 * PUT /api/dashboard/config
 *
 * Proxies to the Alfresco dashboard config webscript (POST /dashboard-config/save).
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

    // Verify access against the *current* stored config to prevent privilege escalation
    const current = await getDashboardConfig(session, site, slug);
    if (!(await hasAccessToDashboard(current.data as DashboardStorageSchema | null, session))) {
      return forbiddenResponse();
    }

    const result = await saveDashboardConfig(session, site, slug, config);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "saving dashboard config to Alfresco");
  }
}

/**
 * DELETE /api/dashboard/config
 *
 * Proxies to the Alfresco dashboard config webscript (POST /dashboard-config/delete).
 * Body: { site: string, slug: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      site?: string;
      slug?: string;
    };
    const { site, slug } = body;

    if (!site || !slug) {
      return badRequestResponse("Missing required fields: site, slug");
    }

    // Verify access before allowing deletion
    const current = await getDashboardConfig(session, site, slug);
    if (!(await hasAccessToDashboard(current.data as DashboardStorageSchema | null, session))) {
      return forbiddenResponse();
    }

    const result = await deleteDashboardConfig(session, site, slug);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "deleting dashboard config from Alfresco");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardAllowableOperations } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

type RouteContext = { params: Promise<{ site: string; slug: string }> };

export type DashboardAccessResponse = {
  canEdit: boolean;
  canManagePermissions: boolean;
};

/**
 * GET /app/api/dashboard/{site}/{slug}/access
 *
 * Returns the current user's effective capabilities on the dashboard node,
 * derived from Alfresco's `allowableOperations`. The UI uses this to gate
 * the edit-mode toggle and the settings dropdown: a Consumer-only user
 * gets `canEdit: false` and the editing UI is hidden.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const { site, slug } = await ctx.params;
  if (!site || !slug) {
    return badRequestResponse("Missing required path parameters: site, slug");
  }

  try {
    const { allowableOperations } = await getDashboardAllowableOperations(
      session,
      site,
      slug
    );
    const response: DashboardAccessResponse = {
      canEdit: allowableOperations.includes("update"),
      canManagePermissions: allowableOperations.includes("updatePermissions"),
    };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "reading dashboard access");
  }
}

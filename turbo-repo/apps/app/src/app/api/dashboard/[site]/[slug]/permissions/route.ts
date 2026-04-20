import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDashboardNodePermissions,
  updateNodePermissions,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";
import type { NodePermissionsUpdate } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { isDashboardRole } from "@/features/dashboard/types/permissions.types";

type RouteContext = { params: Promise<{ site: string; slug: string }> };

/**
 * GET /app/api/dashboard/{site}/{slug}/permissions
 *
 * Resolves the dashboard config node by path and returns its current
 * permission snapshot (inherited + local) via the Alfresco v1 REST API.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const { site, slug } = await ctx.params;
  if (!site || !slug) {
    return badRequestResponse("Missing required path parameters: site, slug");
  }

  try {
    const result = await getDashboardNodePermissions(session, site, slug);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "reading dashboard node permissions");
  }
}

/**
 * PUT /app/api/dashboard/{site}/{slug}/permissions
 *
 * Body: { nodeId: string, permissions: NodePermissionsUpdate }
 *
 * `nodeId` must be taken from the GET response to avoid a second lookup here;
 * the Alfresco backend enforces permission to modify ACLs (Coordinator role).
 */
export async function PUT(request: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const { site, slug } = await ctx.params;
  if (!site || !slug) {
    return badRequestResponse("Missing required path parameters: site, slug");
  }

  let body: { nodeId?: string; permissions?: NodePermissionsUpdate };
  try {
    body = (await request.json()) as {
      nodeId?: string;
      permissions?: NodePermissionsUpdate;
    };
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  const { nodeId, permissions } = body;
  if (!nodeId || !permissions) {
    return badRequestResponse("Missing required fields: nodeId, permissions");
  }

  // Validate role names — reject unknown ones up front with a clear message.
  if (permissions.locallySet) {
    for (const entry of permissions.locallySet) {
      if (!entry.authorityId || !entry.name) {
        return badRequestResponse(
          "Each locallySet entry requires authorityId and name"
        );
      }
      if (!isDashboardRole(entry.name)) {
        return badRequestResponse(
          `Unsupported role: ${entry.name}. Allowed: Consumer, Contributor, Editor, Coordinator`
        );
      }
    }
  }

  try {
    const updated = await updateNodePermissions(session, nodeId, permissions);
    return NextResponse.json({ nodeId, permissions: updated });
  } catch (error) {
    return handleApiError(error, "updating dashboard node permissions");
  }
}

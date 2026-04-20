import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDashboardNodePermissions,
  resolveDashboardNodeId,
  updateNodePermissions,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";
import type {
  AlfrescoPermissionEntry,
  NodePermissionsUpdate,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { isDashboardRole } from "@/features/dashboard/types/permissions.types";

type RouteContext = { params: Promise<{ site: string; slug: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

type ValidationResult =
  | { ok: true; update: NodePermissionsUpdate }
  | { ok: false; message: string };

/**
 * Validates the PUT body shape at the API boundary. Input comes from an
 * untrusted client, so shapes cannot be trusted — reject anything that
 * doesn't match NodePermissionsUpdate before forwarding to Alfresco.
 */
function validatePermissionsUpdate(raw: unknown): ValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, message: "'permissions' must be an object" };
  }

  const { isInheritanceEnabled, locallySet } = raw;

  if (
    isInheritanceEnabled !== undefined &&
    typeof isInheritanceEnabled !== "boolean"
  ) {
    return {
      ok: false,
      message: "'permissions.isInheritanceEnabled' must be a boolean",
    };
  }

  if (locallySet !== undefined && !Array.isArray(locallySet)) {
    return {
      ok: false,
      message: "'permissions.locallySet' must be an array",
    };
  }

  const update: NodePermissionsUpdate = {};
  if (typeof isInheritanceEnabled === "boolean") {
    update.isInheritanceEnabled = isInheritanceEnabled;
  }

  if (Array.isArray(locallySet)) {
    const validated: AlfrescoPermissionEntry[] = [];
    for (let i = 0; i < locallySet.length; i++) {
      const entry = locallySet[i];
      if (!isRecord(entry)) {
        return {
          ok: false,
          message: `'permissions.locallySet[${i}]' must be an object`,
        };
      }
      const { authorityId, name, accessStatus } = entry;
      if (!isNonEmptyString(authorityId)) {
        return {
          ok: false,
          message: `'permissions.locallySet[${i}].authorityId' must be a non-empty string`,
        };
      }
      if (!isNonEmptyString(name)) {
        return {
          ok: false,
          message: `'permissions.locallySet[${i}].name' must be a non-empty string`,
        };
      }
      if (!isDashboardRole(name)) {
        return {
          ok: false,
          message: `Unsupported role '${name}' in locallySet[${i}]. Allowed: Consumer, Contributor, Editor, Coordinator`,
        };
      }
      let status: AlfrescoPermissionEntry["accessStatus"] = "ALLOWED";
      if (accessStatus !== undefined) {
        if (accessStatus !== "ALLOWED" && accessStatus !== "DENIED") {
          return {
            ok: false,
            message: `'permissions.locallySet[${i}].accessStatus' must be 'ALLOWED' or 'DENIED'`,
          };
        }
        status = accessStatus;
      }
      validated.push({ authorityId, name, accessStatus: status });
    }
    update.locallySet = validated;
  }

  return { ok: true, update };
}

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
 * Body: { permissions: NodePermissionsUpdate }
 *
 * The target nodeId is always resolved server-side from the `{site}/{slug}`
 * path — any `nodeId` sent in the body is ignored. This keeps the endpoint
 * strictly scoped to the dashboard identified in the URL, so a caller with
 * Coordinator rights on some other node cannot use this route to mutate that
 * node's ACL. The Alfresco backend still enforces per-node ACL (Coordinator
 * required to change permissions).
 */
export async function PUT(request: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const { site, slug } = await ctx.params;
  if (!site || !slug) {
    return badRequestResponse("Missing required path parameters: site, slug");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  if (!isRecord(body)) {
    return badRequestResponse("Request body must be a JSON object");
  }

  const validation = validatePermissionsUpdate(body.permissions);
  if (!validation.ok) {
    return badRequestResponse(validation.message);
  }

  try {
    const nodeId = await resolveDashboardNodeId(session, site, slug);
    const updated = await updateNodePermissions(
      session,
      nodeId,
      validation.update
    );
    return NextResponse.json({ nodeId, permissions: updated });
  } catch (error) {
    return handleApiError(error, "updating dashboard node permissions");
  }
}

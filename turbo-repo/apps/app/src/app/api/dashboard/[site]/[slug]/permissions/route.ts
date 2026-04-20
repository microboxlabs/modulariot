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

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function validateAccessStatus(
  value: unknown,
  index: number
): ValidationResult<AlfrescoPermissionEntry["accessStatus"]> {
  if (value === undefined) return { ok: true, value: "ALLOWED" };
  if (value === "ALLOWED" || value === "DENIED") {
    return { ok: true, value };
  }
  return fail(
    `'permissions.locallySet[${index}].accessStatus' must be 'ALLOWED' or 'DENIED'`
  );
}

function validateLocallySetEntry(
  entry: unknown,
  index: number
): ValidationResult<AlfrescoPermissionEntry> {
  if (!isRecord(entry)) {
    return fail(`'permissions.locallySet[${index}]' must be an object`);
  }
  const { authorityId, name, accessStatus } = entry;
  if (!isNonEmptyString(authorityId)) {
    return fail(
      `'permissions.locallySet[${index}].authorityId' must be a non-empty string`
    );
  }
  if (!isNonEmptyString(name)) {
    return fail(
      `'permissions.locallySet[${index}].name' must be a non-empty string`
    );
  }
  if (!isDashboardRole(name)) {
    return fail(
      `Unsupported role '${name}' in locallySet[${index}]. Allowed: Consumer, Contributor, Editor, Coordinator`
    );
  }
  const status = validateAccessStatus(accessStatus, index);
  if (!status.ok) return status;
  return { ok: true, value: { authorityId, name, accessStatus: status.value } };
}

function validateLocallySet(
  value: unknown
): ValidationResult<AlfrescoPermissionEntry[] | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value)) {
    return fail("'permissions.locallySet' must be an array");
  }
  const validated: AlfrescoPermissionEntry[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry = validateLocallySetEntry(value[i], i);
    if (!entry.ok) return entry;
    validated.push(entry.value);
  }
  return { ok: true, value: validated };
}

function validateInheritanceEnabled(
  value: unknown
): ValidationResult<boolean | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "boolean") return { ok: true, value };
  return fail("'permissions.isInheritanceEnabled' must be a boolean");
}

/**
 * Validates the PUT body shape at the API boundary. Input comes from an
 * untrusted client, so shapes cannot be trusted — reject anything that
 * doesn't match NodePermissionsUpdate before forwarding to Alfresco.
 */
function validatePermissionsUpdate(
  raw: unknown
): ValidationResult<NodePermissionsUpdate> {
  if (!isRecord(raw)) {
    return fail("'permissions' must be an object");
  }

  const inheritance = validateInheritanceEnabled(raw.isInheritanceEnabled);
  if (!inheritance.ok) return inheritance;

  const locally = validateLocallySet(raw.locallySet);
  if (!locally.ok) return locally;

  const update: NodePermissionsUpdate = {};
  if (inheritance.value !== undefined) {
    update.isInheritanceEnabled = inheritance.value;
  }
  if (locally.value !== undefined) {
    update.locallySet = locally.value;
  }
  return { ok: true, value: update };
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
      validation.value
    );
    return NextResponse.json({ nodeId, permissions: updated });
  } catch (error) {
    return handleApiError(error, "updating dashboard node permissions");
  }
}

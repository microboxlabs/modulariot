import { DashboardServerError } from "../access/errors";
import { isDashboardRole } from "../access/roles";
import type { DashboardVisibility } from "@microboxlabs/miot-dashboard-contract/document";
import type { PermissionAssignment } from "../seams/store";

/** `{ assignments: [{ authorityId, role }] }`, for dashboards and folders. */
export function parseAssignments(body: unknown): PermissionAssignment[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw DashboardServerError.badRequest("Body must be a JSON object");
  }
  const raw = (body as { assignments?: unknown }).assignments;
  if (!Array.isArray(raw)) {
    throw DashboardServerError.badRequest("'assignments' must be an array");
  }
  const authorities = new Set<string>();
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw DashboardServerError.badRequest(
        `'assignments[${index}]' must be an object`,
      );
    }
    const { authorityId, role } = entry as Record<string, unknown>;
    if (typeof authorityId !== "string" || authorityId.length === 0) {
      throw DashboardServerError.badRequest(
        `'assignments[${index}].authorityId' must be a non-empty string`,
      );
    }
    if (!isDashboardRole(role)) {
      throw DashboardServerError.badRequest(
        `'assignments[${index}].role' must be one of Consumer, Contributor, Editor, Coordinator`,
      );
    }
    if (authorities.has(authorityId)) {
      throw DashboardServerError.badRequest(
        `Duplicate authority "${authorityId}"`,
      );
    }
    authorities.add(authorityId);
    return { authorityId, role };
  });
}

/**
 * The optional `visibility` beside the assignments: undefined when absent,
 * so a client that does not know it leaves who sees the item as it is.
 */
export function parseVisibility(
  body: unknown,
): DashboardVisibility | undefined {
  const raw = (body as { visibility?: unknown } | null)?.visibility;
  if (raw === undefined) return undefined;
  if (raw === "organization" || raw === "restricted") return raw;
  throw DashboardServerError.badRequest(
    "'visibility' must be one of organization, restricted",
  );
}

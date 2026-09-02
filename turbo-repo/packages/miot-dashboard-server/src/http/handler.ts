/**
 * The HTTP layer: a Web `Request` in, a Web `Response` out.
 *
 * This is the seam between the package and any way of serving it. It holds no
 * listener and imports no framework, so exactly one implementation serves both
 * shapes the project supports:
 *
 *  - an existing server mounts it (Next route handlers re-export it; anything
 *    fetch-shaped calls it directly),
 *  - the standalone server wraps it in a Node listener.
 *
 * Written against Web standard `Request` and `Response` rather than a
 * framework's own types on purpose. Next 16 route handlers already accept and
 * return these, so a Next adapter is a re-export rather than a translation,
 * and no framework version churn reaches consumers.
 *
 * Every route authorizes before it touches the store. That ordering is not
 * repeated per route: each one calls `authorize` first and uses the decision
 * it returns, which already carries the loaded record.
 */

import {
  createAccessControl,
  type AccessControlOptions,
} from "../access/access-control";
import { DashboardServerError } from "../access/errors";
import { isDashboardRole } from "../access/roles";
import type { PermissionAssignment } from "../seams/store";
import { errorResponse, jsonResponse, noContentResponse } from "./responses";
import { matchRoute, type RouteMatch } from "./routes";

export interface DashboardHandlerOptions extends AccessControlOptions<Request> {
  /**
   * Path prefix the routes are mounted under, e.g. "/api/dashboard".
   * Stripped before matching. Defaults to the root.
   */
  basePath?: string;
}

export type DashboardHandler = (request: Request) => Promise<Response>;

/**
 * Build the request handler.
 *
 * Returns 404 with the standard envelope for anything it does not recognise,
 * so a host mounting it under a prefix gets a consistent body even for a
 * mistyped path.
 */
export function createDashboardHandler(
  options: DashboardHandlerOptions,
): DashboardHandler {
  const access = createAccessControl<Request>(options);
  const basePath = normalizeBasePath(options.basePath);

  async function dispatch(
    request: Request,
    match: RouteMatch,
  ): Promise<Response> {
    const method = request.method.toUpperCase();

    switch (match.route) {
      case "dashboards": {
        if (method !== "GET") return methodNotAllowed();
        const decision = await access.authorize(request, {
          scopeId: match.scopeId,
          action: "dashboard.list",
        });
        const data = await options.store.list(
          decision.identity.tenantId,
          match.scopeId,
        );
        return jsonResponse({ data });
      }

      case "dashboard": {
        const slug = requireSlug(match);
        if (method === "GET") {
          const decision = await access.authorize(request, {
            scopeId: match.scopeId,
            slug,
            action: "dashboard.load",
          });
          // authorize already loaded it; a second store round trip would be
          // both wasteful and a chance for the two reads to disagree.
          const record = decision.dashboard?.record ?? null;
          return jsonResponse({ data: record?.config ?? null });
        }
        if (method === "PUT") {
          const config = await readJsonBody(request);
          const decision = await access.authorize(request, {
            scopeId: match.scopeId,
            slug,
            action: "dashboard.save",
          });
          const expectedRevision = readExpectedRevision(request);
          const saved = await options.store.save(
            refOf(decision.identity.tenantId, match.scopeId, slug),
            config,
            {
              updatedBy: decision.identity.userId,
              ...(expectedRevision === undefined ? {} : { expectedRevision }),
            },
          );
          return jsonResponse(
            { data: { revision: saved.revision, updatedAt: saved.updatedAt } },
            200,
          );
        }
        if (method === "DELETE") {
          const decision = await access.authorize(request, {
            scopeId: match.scopeId,
            slug,
            action: "dashboard.delete",
          });
          if (decision.dashboard?.record == null) {
            throw DashboardServerError.notFound("Dashboard not found");
          }
          await options.store.remove(
            refOf(decision.identity.tenantId, match.scopeId, slug),
          );
          return noContentResponse();
        }
        return methodNotAllowed();
      }

      case "capabilities": {
        if (method !== "GET") return methodNotAllowed();
        const capabilities = await access.capabilities(
          request,
          match.scopeId,
          requireSlug(match),
        );
        return jsonResponse(capabilities);
      }

      case "permissions": {
        const slug = requireSlug(match);
        if (method === "GET") {
          const decision = await access.authorize(request, {
            scopeId: match.scopeId,
            slug,
            action: "dashboard.permissions.read",
          });
          return jsonResponse({
            assignments: decision.dashboard?.assignments ?? [],
          });
        }
        if (method === "PUT") {
          const body = await readJsonBody(request);
          const assignments = parseAssignments(body);
          const decision = await access.authorize(request, {
            scopeId: match.scopeId,
            slug,
            action: "dashboard.permissions.write",
          });
          await options.store.setPermissions(
            refOf(decision.identity.tenantId, match.scopeId, slug),
            assignments,
          );
          return noContentResponse();
        }
        return methodNotAllowed();
      }
    }
  }

  return async function handle(request: Request): Promise<Response> {
    try {
      const pathname = pathnameOf(request.url);
      const routable = stripBasePath(pathname, basePath);
      if (routable === null) return errorResponse(notFound());
      const match = matchRoute(routable);
      if (match === null) return errorResponse(notFound());
      return await dispatch(request, match);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

// ------------------------------------------------------------- helpers ----

const refOf = (tenantId: string, scopeId: string, slug: string) => ({
  tenantId,
  scopeId,
  slug,
});

const notFound = () => DashboardServerError.notFound("No such endpoint");

function methodNotAllowed(): Response {
  // Deliberately the same envelope as everything else, and deliberately a 404
  // rather than a 405: which methods exist on a path is not something an
  // unauthorized caller should be able to enumerate.
  return errorResponse(notFound());
}

function requireSlug(match: RouteMatch): string {
  if (match.slug === undefined) {
    throw DashboardServerError.badRequest("Missing dashboard slug");
  }
  return match.slug;
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // A relative URL is legal in some server frameworks' request objects.
    return url.split("?")[0] ?? "/";
  }
}

const SLASH = "/".charCodeAt(0);

/**
 * Trim trailing slashes and guarantee a leading one.
 *
 * Deliberately not `replace(/\/+$/, "")`. A repeated character class anchored
 * at the end backtracks quadratically, so a long run of slashes costs time
 * proportional to its square. CodeQL flags it as a polynomial regular
 * expression and it is right to: the value reaches here from configuration
 * that a deployment can set, and the linear version below is no harder to
 * read.
 */
function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) return "";
  let end = basePath.length;
  while (end > 0 && basePath.charCodeAt(end - 1) === SLASH) end--;
  const trimmed = basePath.slice(0, end);
  if (trimmed.length === 0) return "";
  return trimmed.charCodeAt(0) === SLASH ? trimmed : `/${trimmed}`;
}

/** Returns the remaining path, or null when the prefix does not match. */
function stripBasePath(pathname: string, basePath: string): string | null {
  if (basePath === "") return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }
  return null;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw DashboardServerError.badRequest("Request body must be valid JSON");
  }
}

/**
 * Optimistic concurrency token.
 *
 * `If-Match` is the standard header for it. The store decides whether the
 * revision is stale and signals a conflict; this layer only carries the value.
 */
function readExpectedRevision(request: Request): number | undefined {
  const header = request.headers.get("if-match");
  if (header === null) return undefined;
  const value = Number(header.replace(/^W\/|"/g, "").trim());
  if (!Number.isInteger(value) || value < 0) {
    throw DashboardServerError.badRequest(
      "If-Match must be an integer revision",
    );
  }
  return value;
}

function parseAssignments(body: unknown): PermissionAssignment[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw DashboardServerError.badRequest("Body must be a JSON object");
  }
  const raw = (body as { assignments?: unknown }).assignments;
  if (!Array.isArray(raw)) {
    throw DashboardServerError.badRequest("'assignments' must be an array");
  }
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
    return { authorityId, role };
  });
}

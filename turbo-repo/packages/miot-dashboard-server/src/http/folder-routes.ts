/**
 * The folder routes, split out of the handler to keep it readable. Like every
 * other route, each one authorizes before it parses or touches a store.
 *
 *   GET    /folders                   the folders the caller sees, with their role on each
 *   POST   /folders                   create one
 *   PATCH  /folders/{id}              rename it, move it, or both
 *   DELETE /folders/{id}              delete it with everything inside
 *   GET    /folders/{id}/permissions  its own permissions and who sees it
 *   PUT    /folders/{id}/permissions  replace them, and who sees it
 *   PUT    /dashboards/{slug}/folder  file a dashboard in a folder
 *
 * Folders have permissions of their own, apart from their dashboards'. The
 * caller's role on a folder is the higher of their scope role and the
 * folder's permissions naming them: Consumer sees it, Editor creates inside,
 * renames and moves it, Coordinator deletes it and manages its permissions.
 * At the top level the scope role alone decides.
 */

import type { AccessControl, AccessDecision } from "../access/access-control";
import { DashboardServerError } from "../access/errors";
import { roleAtLeast, type DashboardRole } from "../access/roles";
import {
  folderRoleOf,
  folderVisible,
  movementWidensVisibility,
  OPEN_SCOPE,
  type ScopeVisibility,
} from "../access/visibility";
import type { DashboardFolderStore, FolderScope } from "../seams/folders";
import type { ServerDashboardStore } from "../seams/store";
import { parseAssignments, parseVisibility } from "./parse-assignments";
import {
  parseFolderPatch,
  parseNewFolder,
  parsePlacement,
} from "./parse-folder";
import { errorResponse, jsonResponse, noContentResponse } from "./responses";
import type { RouteMatch } from "./routes";
import { removeAuthorizedDashboard } from "./remove-dashboard";

type Route = (request: Request, match: RouteMatch) => Promise<Response>;

export interface FolderRouteOptions {
  access: AccessControl<Request>;
  store: ServerDashboardStore;
  /** Omitted: every folder route answers 404. */
  folders: DashboardFolderStore | undefined;
  /** The scope's folders, their permissions and where dashboards are. */
  visibility?: (scope: FolderScope) => Promise<ScopeVisibility>;
  readBody: (request: Request) => Promise<unknown>;
}

const notFound = () => DashboardServerError.notFound("No such endpoint");

/** A 404, as in the handler: which methods exist is not for enumerating. */
function methodNotAllowed(): Response {
  return errorResponse(notFound());
}

function requireFolderId(match: RouteMatch): string {
  if (match.id === undefined) {
    throw DashboardServerError.badRequest("Missing identifier");
  }
  return match.id;
}

/** Folder actions and the role on the folder each needs. */
const NEEDS: Readonly<Record<"see" | "edit" | "manage", DashboardRole>> = {
  see: "Consumer",
  edit: "Editor",
  manage: "Coordinator",
};

/**
 * Refuses unless the caller may `need` on the folder (or, for null, at the
 * top level). A folder the caller cannot see answers 404, as if absent.
 */
function requireOn(
  decision: AccessDecision,
  folderId: string | null,
  need: keyof typeof NEEDS,
  scope: ScopeVisibility,
): void {
  const { identity, scopeRole } = decision;
  if (folderId === null) {
    if (!roleAtLeast(scopeRole, NEEDS[need])) {
      throw DashboardServerError.forbidden(
        "CAPABILITY",
        "Your role in this scope does not allow this at the top level",
      );
    }
    return;
  }
  if (!folderVisible(identity, scopeRole, folderId, scope)) {
    throw DashboardServerError.notFound("Folder not found");
  }
  const role = folderRoleOf(identity, scopeRole, folderId, scope);
  if (!roleAtLeast(role, NEEDS[need])) {
    throw DashboardServerError.forbidden(
      "CAPABILITY",
      "Your role on this folder does not allow this",
    );
  }
}

export function createFolderRoutes(
  options: FolderRouteOptions,
): Record<
  "folders" | "folder" | "folderPermissions" | "dashboardFolder",
  Route
> {
  const { access, readBody } = options;

  /** 404 rather than 501, as for the other optional stores. */
  const requireFolders = (): DashboardFolderStore => {
    if (options.folders === undefined) throw notFound();
    return options.folders;
  };

  /** The tenant the access control resolved, never the one in the path. */
  const scopeOf = (tenantId: string, match: RouteMatch): FolderScope => ({
    tenantId,
    scopeId: match.scopeId,
  });

  const visibilityOf = (scope: FolderScope) =>
    options.visibility
      ? options.visibility(scope)
      : Promise.resolve(OPEN_SCOPE);

  /** Folder grants never confer permission-management rights on their contents. */
  async function requireSubtreeSharing(
    request: Request,
    match: RouteMatch,
    decision: AccessDecision,
    visibility: ScopeVisibility,
  ): Promise<void> {
    const scope = scopeOf(decision.identity.tenantId, match);
    const subtree = await requireFolders().subtree(
      scope,
      requireFolderId(match),
    );
    if (subtree === null)
      throw DashboardServerError.notFound("Folder not found");
    for (const id of subtree.folderIds)
      requireOn(decision, id, "manage", visibility);
    for (const slug of subtree.slugs) {
      await access.authorize(request, {
        tenantId: scope.tenantId,
        scopeId: scope.scopeId,
        slug,
        action: "dashboard.permissions.read",
      });
    }
  }

  /**
   * Every dashboard inside is authorized for deletion before any of them is
   * removed, so a folder holding one dashboard the caller may not delete is
   * refused whole instead of half emptied.
   */
  async function removeFolder(
    request: Request,
    match: RouteMatch,
    folders: DashboardFolderStore,
  ): Promise<Response> {
    const decision = await access.authorize(request, {
      tenantId: match.tenantId,
      scopeId: match.scopeId,
      action: "folder.delete",
    });
    const scope = scopeOf(decision.identity.tenantId, match);
    const folderId = requireFolderId(match);
    const visibility = await visibilityOf(scope);
    requireOn(decision, folderId, "manage", visibility);
    const subtree = await folders.subtree(scope, folderId);
    if (subtree === null) {
      throw DashboardServerError.notFound("Folder not found");
    }
    for (const id of subtree.folderIds)
      requireOn(decision, id, "manage", visibility);
    const existing: { slug: string; revision: number }[] = [];
    for (const slug of subtree.slugs) {
      const dashboard = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        slug,
        action: "dashboard.delete",
      });
      if (dashboard.dashboard?.record != null)
        existing.push({ slug, revision: dashboard.dashboard.record.revision });
    }
    for (const { slug, revision } of existing) {
      await removeAuthorizedDashboard(
        options.store,
        { ...scope, slug },
        revision,
      );
    }
    await folders.removeFolders(scope, subtree.folderIds);
    return noContentResponse();
  }

  return {
    async folders(request, match) {
      const folders = requireFolders();
      const method = request.method.toUpperCase();
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "folder.list",
        });
        const scope = scopeOf(decision.identity.tenantId, match);
        const visibility = await visibilityOf(scope);
        const { identity, scopeRole } = decision;
        const all = [...visibility.folders.values()];
        // Who made a folder stays on the server; the caller's role on each
        // is what the client needs to offer the right actions.
        const data = all
          .filter((f) => folderVisible(identity, scopeRole, f.id, visibility))
          .map((f) => ({
            id: f.id,
            name: f.name,
            parentId: f.parentId,
            role: folderRoleOf(identity, scopeRole, f.id, visibility),
          }));
        return jsonResponse({ data });
      }
      if (method === "POST") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "folder.write",
        });
        const scope = scopeOf(decision.identity.tenantId, match);
        const input = parseNewFolder(await readBody(request));
        requireOn(decision, input.parentId, "edit", await visibilityOf(scope));
        // Kept to who its creator names until they open it up, like a
        // new dashboard.
        const data = await folders.create(
          scope,
          { ...input, visibility: "restricted" },
          decision.identity.userId,
        );
        if (!roleAtLeast(decision.scopeRole, "Contributor")) {
          // A delegated Editor may create here despite Consumer scope standing.
          // Explicit rights let them manage the new restricted child; ordinary
          // creators still use the revocable Contributor-standing policy.
          await folders.setPermissions(scope, data.id, [
            { authorityId: decision.identity.userId, role: "Coordinator" },
          ]);
        }
        return jsonResponse(
          { data: { id: data.id, name: data.name, parentId: data.parentId } },
          201,
        );
      }
      return methodNotAllowed();
    },

    async folder(request, match) {
      const folders = requireFolders();
      const method = request.method.toUpperCase();
      if (method === "PATCH") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "folder.write",
        });
        const scope = scopeOf(decision.identity.tenantId, match);
        const folderId = requireFolderId(match);
        const patch = parseFolderPatch(await readBody(request));
        const visibility = await visibilityOf(scope);
        requireOn(decision, folderId, "edit", visibility);
        if (patch.parentId !== undefined) {
          // Moving also needs the right to put things where it goes.
          requireOn(decision, patch.parentId, "edit", visibility);
          const previousParent =
            visibility.folders.get(folderId)?.parentId ?? null;
          if (
            movementWidensVisibility(previousParent, patch.parentId, visibility)
          ) {
            if (!decision.identity.capabilities.canManagePermissions) {
              throw DashboardServerError.forbidden(
                "CAPABILITY",
                "Your credentials do not allow changing who sees this folder",
              );
            }
            requireOn(decision, folderId, "manage", visibility);
            await requireSubtreeSharing(request, match, decision, visibility);
          }
        }
        const data = await folders.update(scope, folderId, patch);
        return jsonResponse({
          data: { id: data.id, name: data.name, parentId: data.parentId },
        });
      }
      if (method === "DELETE") return removeFolder(request, match, folders);
      return methodNotAllowed();
    },

    async folderPermissions(request, match) {
      const folders = requireFolders();
      const method = request.method.toUpperCase();
      if (method !== "GET" && method !== "PUT") return methodNotAllowed();
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action:
          method === "GET"
            ? "folder.permissions.read"
            : "folder.permissions.write",
      });
      const scope = scopeOf(decision.identity.tenantId, match);
      const folderId = requireFolderId(match);
      const visibility = await visibilityOf(scope);
      requireOn(decision, folderId, "manage", visibility);
      if (method === "GET") {
        return jsonResponse({
          assignments: visibility.folderPermissions.get(folderId) ?? [],
          visibility:
            visibility.folders.get(folderId)?.visibility ?? "organization",
        });
      }
      const body = await readBody(request);
      const assignments = parseAssignments(body);
      const nextVisibility = parseVisibility(body);
      const previous =
        visibility.folders.get(folderId)?.visibility ?? "organization";
      const previousAuthorities = new Set(
        (visibility.folderPermissions.get(folderId) ?? []).map(
          (a) => a.authorityId,
        ),
      );
      if (
        previous === "restricted" &&
        (nextVisibility === "organization" ||
          assignments.some((a) => !previousAuthorities.has(a.authorityId)))
      ) {
        await requireSubtreeSharing(request, match, decision, visibility);
      }
      await folders.setPermissions(
        scope,
        folderId,
        assignments,
        nextVisibility,
      );
      return noContentResponse();
    },

    async dashboardFolder(request, match) {
      const folders = requireFolders();
      if (request.method.toUpperCase() !== "PUT") return methodNotAllowed();
      if (match.slug === undefined) {
        throw DashboardServerError.badRequest("Missing dashboard slug");
      }
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        slug: match.slug,
        action: "dashboard.move",
      });
      if (decision.dashboard?.record == null) {
        throw DashboardServerError.notFound("Dashboard not found");
      }
      const scope = scopeOf(decision.identity.tenantId, match);
      const folderId = parsePlacement(await readBody(request));
      const visibility = await visibilityOf(scope);
      if (
        movementWidensVisibility(
          visibility.placements.get(match.slug) ?? null,
          folderId,
          visibility,
        ) &&
        !decision.dashboard.capabilities.canManagePermissions
      ) {
        throw DashboardServerError.forbidden(
          "CAPABILITY",
          "Only who manages this dashboard's permissions may expose it outside a restricted folder",
        );
      }
      if (folderId !== null) {
        requireOn(decision, folderId, "edit", visibility);
      }
      const placed = await folders.placeDashboard(scope, match.slug, folderId);
      if (!placed) throw DashboardServerError.notFound("Dashboard not found");
      return noContentResponse();
    },
  };
}

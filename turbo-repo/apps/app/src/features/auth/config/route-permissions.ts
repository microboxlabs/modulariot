import type { AccessRule } from "../access/access-control";
import { ACCESS_RULES } from "../access/access-rules";

const OPEN: AccessRule = {};

/** Page access by path prefix; the longest matching prefix wins. */
export const ROUTE_PERMISSIONS: Record<string, AccessRule> = {
  "/": OPEN,
  "/home": ACCESS_RULES.dashboards,
  "/shipping": ACCESS_RULES.kanban,
  "/mytasks": ACCESS_RULES.kanban,
  "/planning": ACCESS_RULES.kanbanPage,
  "/delivery": ACCESS_RULES.kanbanPage,
  "/task/edit": ACCESS_RULES.kanbanPage,
  "/task/view": ACCESS_RULES.kanbanPage,
  "/finished": ACCESS_RULES.finished,
  "/reports": ACCESS_RULES.reports,
  "/geographic-view": ACCESS_RULES.geographic,
  "/symptoms": ACCESS_RULES.controlTower,
  "/where-is-my-load": ACCESS_RULES.loadsSearch,
  "/calendar": ACCESS_RULES.calendarPage,
  "/live-streams": ACCESS_RULES.liveStreamsPage,
  "/collaborators-management": ACCESS_RULES.collaboratorsPage,
  "/whatsapp/conversations": ACCESS_RULES.conversations,
  "/admin/console": ACCESS_RULES.adminConsole,

  "/users/settings": OPEN,

  // Integrations job console — any authenticated org member; the backend
  // enforces org membership per request.
  "/integrations/jobs": OPEN,

  // Storytelling (list + /storytelling/[id] detail, matched by prefix) — any
  // authenticated org member (frontend-only demo for now).
  "/storytelling": OPEN,

  // Fleet (list, /fleet/[assetId] and its edit page, matched by prefix) — any
  // authenticated member; the modulith checks fleet:assets.view / .edit.
  "/fleet": OPEN,

  // Settings › Connections (templates + connections) — any authenticated member;
  // the backend owner-gates every mutation per request.
  "/users/settings/connections": OPEN,
};

export function getRouteRule(path: string): AccessRule {
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  return matchingRoute ? ROUTE_PERMISSIONS[matchingRoute] : OPEN;
}

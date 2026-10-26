/**
 * `BOARD_MODULE` picks the work model a deployment shows: "kanban" (Alfresco
 * tasks, with My tasks, Where is my load and Collaborators) or "trips" (the
 * trips board). Any other value, including empty, shows both.
 */
export type BoardModule = "kanban" | "trips";

const KANBAN_PATHS = new Set([
  "/planning",
  "/shipping",
  "/delivery",
  "/finished",
  "/where-is-my-load",
]);

const KANBAN_PREFIXES = ["/mytasks", "/task/", "/collaborators-management"];

/** Sidebar sections that belong to the kanban model. */
export const KANBAN_SECTIONS = new Set([
  "kanban",
  "tasks",
  "whereIsMyLoad",
  "collaboratorsManagement",
]);

export function boardEnabled(
  module: BoardModule,
  setting: string | null | undefined
): boolean {
  const value = setting?.trim().toLowerCase();
  return (value !== "kanban" && value !== "trips") || value === module;
}

/** The board a path belongs to, or null when it is not a board page. */
export function boardOfPath(path: string): BoardModule | null {
  if (path === "/trips" || path.startsWith("/trips/")) return "trips";
  if (KANBAN_PATHS.has(path)) return "kanban";
  return KANBAN_PREFIXES.some((p) => path.startsWith(p)) ? "kanban" : null;
}

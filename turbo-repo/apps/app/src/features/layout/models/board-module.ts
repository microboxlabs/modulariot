/**
 * `BOARD_MODULE` picks the work board a deployment shows: "kanban" (Alfresco
 * tasks) or "trips" (the trips board). Any other value, including empty,
 * shows both.
 */
export type BoardModule = "kanban" | "trips";

const KANBAN_PATHS = ["/planning", "/shipping", "/delivery", "/finished"];

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
  return KANBAN_PATHS.includes(path) ? "kanban" : null;
}

import { locales } from "@/features/i18n/tr.service";

const STORAGE_KEY = "miot:kanban-return";

/** The Kanban pages a task can be opened from. */
const KANBAN_PAGES = new Set([
  "shipping",
  "delivery",
  "planning",
  "finished",
  "mytasks",
]);

/** `/es/shipping?serviceType=X` → `/shipping?serviceType=X`, or null when it is not a Kanban page. */
function kanbanPathWithoutLocale(href: string): string | null {
  if (!href.startsWith("/")) return null;
  const [path] = href.split("?");
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2 || !locales.includes(segments[0])) return null;
  if (segments.length !== 2 || !KANBAN_PAGES.has(segments[1])) return null;
  return href.slice(segments[0].length + 1);
}

/** Remembers the Kanban view (page and filters) a task is opened from. */
export function rememberKanbanView(href: string): void {
  if (!kanbanPathWithoutLocale(href)) return;
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, href);
  } catch {
    // Storage can be blocked; the task type's board is the fallback.
  }
}

function rememberedKanbanView(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Where to go after a task is completed: the Kanban view the user came from,
 * else `fallbackPath` (the board of the task's process). Always in `lang`.
 */
export function kanbanReturnHref(lang: string, fallbackPath: string): string {
  const remembered = rememberedKanbanView();
  const path =
    (remembered && kanbanPathWithoutLocale(remembered)) ?? fallbackPath;
  return `/${lang}${path}`;
}

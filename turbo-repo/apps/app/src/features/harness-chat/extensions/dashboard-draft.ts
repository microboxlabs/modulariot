import {
  GRID_COLS,
  type DashboardStorageSchema,
  type GridLayoutItem,
  type Widget,
} from "@/features/dashboard/types/dashboard.types";
import { generateSlug } from "@/features/dashboard/components/dashboard-landing/create-dashboard-modal.config";

export const SHOW_DASHBOARD_DRAFT_TOOL = "show_dashboard_draft";

export type DraftDashlet = {
  widgetId: string;
  dashletId: string;
  config: Record<string, unknown>;
};

export type ShowDashboardDraftArgs = {
  id: string;
  title: string;
  description?: string;
  dashlets: DraftDashlet[];
  /** Widget ids the relay could not find in the thread. */
  missing?: string[];
};

/** Grid size per dashlet on the saved dashboard: KPIs four to a row, charts
 * two, tables the full width. */
const SIZES: Record<string, { w: number; h: number }> = {
  stat_icon: { w: 6, h: 2 },
  chart_v2: { w: 12, h: 7 },
  data_table_v2: { w: GRID_COLS, h: 8 },
};
const DEFAULT_SIZE = { w: 12, h: 6 };

export function sizeOf(dashletId: string): { w: number; h: number } {
  return SIZES[dashletId] ?? DEFAULT_SIZE;
}

/** Places the dashlets left to right in their order, starting a new row when
 * the next one does not fit. */
export function layoutDashlets(dashlets: DraftDashlet[]): GridLayoutItem[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return dashlets.map((dashlet, index) => {
    const { w, h } = sizeOf(dashlet.dashletId);
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const item = { i: String(index), x, y, w, h };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return item;
  });
}

export function draftToDashboard(
  draft: ShowDashboardDraftArgs,
  name: string,
  opts: { now?: string; newId?: () => string } = {}
): DashboardStorageSchema {
  const now = opts.now ?? new Date().toISOString();
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const layout = layoutDashlets(draft.dashlets);
  const widgets: Widget[] = draft.dashlets.map((dashlet, index) => {
    const id = newId();
    return {
      id,
      componentId: dashlet.dashletId,
      layout: { ...layout[index], i: id },
      config: dashlet.config,
      createdAt: now,
      updatedAt: now,
    };
  });
  return {
    version: 2,
    name,
    widgets,
    preferences: { editMode: false },
  };
}

/** The first of `base`, `base-2`, `base-3`… that no dashboard uses yet, or
 * null when the name gives no slug or every candidate is taken. */
export async function freeSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
  attempts = 20
): Promise<string | null> {
  const base = generateSlug(name);
  if (!base) return null;
  for (let n = 1; n <= attempts; n++) {
    const slug = n === 1 ? base : `${base.slice(0, 46)}-${n}`;
    if (!(await exists(slug))) return slug;
  }
  return null;
}

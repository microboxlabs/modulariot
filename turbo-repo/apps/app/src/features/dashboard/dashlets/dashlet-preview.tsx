"use client";

import type { ComponentType } from "react";
import { getDashlet } from "./index";
import type { DashletComponentProps } from "./types";
import type { Widget } from "../types/dashboard.types";
import {
  defaultFilter as dataTableV2DefaultFilter,
  defaultSort as dataTableV2DefaultSort,
} from "./data_table_v2/dashlet";
import {
  defaultFilter as dataListDefaultFilter,
  defaultSort as dataListDefaultSort,
} from "./data_list/dashlet";

/**
 * Shared "render a dashlet standalone, outside a real dashboard grid" logic
 * — used by both the harness-chat show_dashlet card and the /dev/components
 * gallery. One place for the sizing formula and config overrides so the two
 * views can never drift apart.
 *
 * Dashlets that read dashboard context (active filters, edit mode, live
 * polling) fall back to safe, inert defaults outside a DashboardProvider —
 * see useOptionalDashboard/useOptionalPlannerContext — so this works without
 * mounting the real, heavy dashboard provider tree (widget storage, planner,
 * kiosk mode…) a dashboard page normally needs.
 */

// Matches the real dashboard's react-grid-layout config (dashboard-view.tsx)
// so a dashlet asking for N grid rows gets the same pixel budget standalone
// that it'd get on the dashboard.
const GRID_ROW_HEIGHT_PX = 55;
const GRID_ROW_MARGIN_PX = 16;

/**
 * Standalone-only `minH` overrides, keyed by dashlet id — NOT the dashlet's
 * real `getLayoutDefaults()`, which also sizes a freshly-dropped widget on
 * the real dashboard. Every dashlet's standalone height goes through the
 * exact same formula below, using either its real minH or, if present here,
 * this one instead — there's no separate "just set a pixel value" path, so
 * every dashlet is sized the same way.
 *
 * Unlike the real minH (whole grid rows), this can be fractional — nothing
 * here touches the actual grid, so there's no reason to round to a row.
 *
 * Empty for now — every dashlet currently looks right off its own real
 * minH. Add an entry here only once you've actually seen a specific
 * dashlet's standalone size look wrong.
 */
const STANDALONE_MIN_H_OVERRIDES: Partial<Record<string, number>> = {};

/**
 * Standalone-only config overrides, keyed by dashlet id — merged between the
 * dashlet's own defaultConfig and whatever the caller explicitly passes
 * (so an explicit caller value still wins over this layer).
 *
 * Use this for dashboard-oriented UI chrome that doesn't make sense
 * standalone — e.g. data_table_v2's filter pills and sort row are meant for
 * interactive use on a real dashboard; standalone there's just a result to
 * read, so we turn them off via the dashlet's own `filter.enabled` /
 * `sort.enabled` config (no dashlet code changes — these flags already
 * exist). Add an entry here for a dashlet's *config*; use
 * STANDALONE_MIN_H_OVERRIDES above for its *size*. If a dashlet doesn't
 * belong standalone at all, that's `showInChat: false` on its own
 * definition instead — see e.g. data_table/index.ts, chart/index.ts,
 * info_card/index.ts.
 *
 * `showRowCount: false` is included for the same reason as filter/sort, plus
 * a real bug it happens to route around: DashletTitleBar's row-count label
 * is built with `trDynamic("dashboard.settings.totalItems", dictionary, …)`,
 * and with the standalone empty dictionary fallback that resolves to
 * nothing — `translate()` in tr.service.ts returns the raw path string
 * itself, so the literal text "dashboard.settings.totalItems" would render
 * on-screen. `showRowCount` gates that whole label away, same lever, no
 * dashlet change.
 *
 * `showExport: false` is the same idea again — a working CSV-export button
 * over synthetic preview data is dashboard-only affordance, not something a
 * one-shot standalone preview should offer.
 */
const STANDALONE_CONFIG_OVERRIDES: Partial<Record<string, Record<string, unknown>>> = {
  data_table_v2: {
    filter: { ...dataTableV2DefaultFilter, enabled: false },
    sort: { ...dataTableV2DefaultSort, enabled: false },
    showRowCount: false,
    showExport: false,
  },
  data_list: {
    filter: { ...dataListDefaultFilter, enabled: false },
    sort: { ...dataListDefaultSort, enabled: false },
    showRowCount: false,
  },
};

export type ResolvedDashletPreview =
  | { status: "unknown" }
  | { status: "excluded"; name: string }
  | {
      status: "ok";
      Component: ComponentType<DashletComponentProps>;
      widget: Widget;
      heightPx: number;
    };

export function resolveDashletPreview(
  dashletId: string,
  configOverride?: Record<string, unknown>,
): ResolvedDashletPreview {
  const dashlet = getDashlet(dashletId);
  if (!dashlet) return { status: "unknown" };
  if (dashlet.showInChat === false) {
    return { status: "excluded", name: dashlet.meta.name };
  }

  const now = new Date().toISOString();
  const config = {
    ...dashlet.defaultConfig,
    ...STANDALONE_CONFIG_OVERRIDES[dashletId],
    ...configOverride,
  };
  const { minH: realMinH = 1 } = dashlet.getLayoutDefaults(config);
  const minH = STANDALONE_MIN_H_OVERRIDES[dashletId] ?? realMinH;
  const widget: Widget = {
    id: `standalone-preview-${dashletId}`,
    componentId: dashletId,
    layout: { i: "standalone-preview", x: 0, y: 0, w: 4, h: minH },
    config,
    createdAt: now,
    updatedAt: now,
  };

  // Same formula for every minH, no exceptions — this is exactly what the
  // real dashboard grid already gives a widget of this size (minH: 1 is a
  // real 55px row there, not "no height"). STANDALONE_MIN_H_OVERRIDES only
  // changes the input to this formula, never bypasses it.
  const heightPx = minH * GRID_ROW_HEIGHT_PX + (minH - 1) * GRID_ROW_MARGIN_PX;

  return { status: "ok", Component: dashlet.Component, widget, heightPx };
}

/**
 * Renders a dashlet standalone given just its id (+ optional config
 * overrides) — no wrapper chrome, no "unknown"/"excluded" messaging (callers
 * decide how to handle those; see resolveDashletPreview's status). Returns
 * null for anything that isn't a clean "ok" render.
 */
export function DashletPreview({
  dashletId,
  config,
}: Readonly<{ dashletId: string; config?: Record<string, unknown> }>) {
  const resolved = resolveDashletPreview(dashletId, config);
  if (resolved.status !== "ok") return null;

  const { Component, widget, heightPx } = resolved;
  return (
    <div
      className="w-full max-w-[90%] overflow-hidden rounded-lg"
      style={{ height: heightPx }}
    >
      <Component widget={widget} editMode={false} />
    </div>
  );
}

import { describe, expect, it } from "vitest";
import {
  draftToDashboard,
  freeSlug,
  layoutDashlets,
  type DraftDashlet,
} from "./dashboard-draft";

const kpi = (n: number): DraftDashlet => ({
  widgetId: `k${n}`,
  dashletId: "stat_icon",
  config: { title: `KPI ${n}` },
});
const chart: DraftDashlet = {
  widgetId: "c",
  dashletId: "chart_v2",
  config: { title: "Trips" },
};
const table: DraftDashlet = {
  widgetId: "t",
  dashletId: "data_table_v2",
  config: { title: "Detail" },
};

describe("layoutDashlets", () => {
  it("fills rows left to right and wraps what does not fit", () => {
    const layout = layoutDashlets([
      kpi(1),
      kpi(2),
      kpi(3),
      kpi(4),
      kpi(5),
      chart,
      table,
    ]);

    expect(layout.map(({ x, y, w, h }) => [x, y, w, h])).toEqual([
      [0, 0, 6, 2],
      [6, 0, 6, 2],
      [12, 0, 6, 2],
      [18, 0, 6, 2],
      [0, 2, 6, 2],
      [6, 2, 12, 7],
      [0, 9, 24, 8],
    ]);
  });
});

describe("draftToDashboard", () => {
  it("makes a dashboard of the dashlets, each with its config and a layout keyed by its id", () => {
    let n = 0;
    const dashboard = draftToDashboard(
      { id: "d1", title: "Trips", dashlets: [kpi(1), table] },
      "Trips this week",
      { now: "2026-09-28T00:00:00.000Z", newId: () => `id-${++n}` }
    );

    expect(dashboard).toEqual({
      version: 2,
      name: "Trips this week",
      preferences: { editMode: false },
      widgets: [
        {
          id: "id-1",
          componentId: "stat_icon",
          layout: { i: "id-1", x: 0, y: 0, w: 6, h: 2 },
          config: { title: "KPI 1" },
          createdAt: "2026-09-28T00:00:00.000Z",
          updatedAt: "2026-09-28T00:00:00.000Z",
        },
        {
          id: "id-2",
          componentId: "data_table_v2",
          layout: { i: "id-2", x: 0, y: 2, w: 24, h: 8 },
          config: { title: "Detail" },
          createdAt: "2026-09-28T00:00:00.000Z",
          updatedAt: "2026-09-28T00:00:00.000Z",
        },
      ],
    });
  });
});

describe("freeSlug", () => {
  it("takes the name's slug, or the first numbered one not in use", async () => {
    const taken = new Set(["viajes-por-dia", "viajes-por-dia-2"]);
    const exists = async (slug: string) => taken.has(slug);

    expect(await freeSlug("Otro tablero", exists)).toBe("otro-tablero");
    expect(await freeSlug("Viajes por dia", exists)).toBe("viajes-por-dia-3");
  });

  it("gives up on a name without a slug or when every candidate is taken", async () => {
    expect(await freeSlug("¿?", async () => false)).toBeNull();
    expect(await freeSlug("a", async () => true, 3)).toBeNull();
  });
});

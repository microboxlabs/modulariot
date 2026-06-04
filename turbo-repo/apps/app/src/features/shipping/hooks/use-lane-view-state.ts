import { useCallback, useEffect, useState } from "react";

export type LaneDensity = "inherit" | "compact" | "expanded";
export type LaneSort = "none" | "priority" | "eta" | "code";
export type LaneFilter = "none" | "urgent" | "actionable";

export interface LaneViewState {
  density: LaneDensity;
  sort: LaneSort;
  filter: LaneFilter;
  collapsed: boolean;
}

export const DEFAULT_LANE_STATE: LaneViewState = {
  density: "inherit",
  sort: "none",
  filter: "none",
  collapsed: false,
};

const STORAGE_KEY = "kanbanLaneViewState";

/**
 * Per-lane view preferences (density / sort / filter / collapsed), keyed by the
 * lane's stable workflow title rather than its numeric board id (ids repeat
 * across the shipping/planning/delivery boards and would otherwise collide).
 * View-only: nothing here writes back to the workflow.
 */
export function useLaneViewState() {
  const [map, setMap] = useState<Record<string, LaneViewState>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setMap(JSON.parse(raw) as Record<string, LaneViewState>);
      }
    } catch {
      // Ignore malformed persisted state and start fresh.
    }
  }, []);

  const getLaneState = useCallback(
    (key: string): LaneViewState => map[key] ?? DEFAULT_LANE_STATE,
    [map]
  );

  const updateLaneState = useCallback(
    (key: string, patch: Partial<LaneViewState>) => {
      setMap((prev) => {
        const next = {
          ...prev,
          [key]: { ...(prev[key] ?? DEFAULT_LANE_STATE), ...patch },
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage may be unavailable (private mode); keep in-memory state.
        }
        return next;
      });
    },
    []
  );

  return { getLaneState, updateLaneState };
}

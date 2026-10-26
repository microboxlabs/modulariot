"use client";

/** Client for the trips board API (`/trips/board/{view}`) through the `/api/trips/*` proxy. */

import useSWR from "swr";
import { tripsRequest } from "../monitors/monitors-api";

export const BOARD_VIEWS = [
  "planning",
  "dispatch",
  "delivery",
  "finished",
] as const;
export type BoardViewKey = (typeof BOARD_VIEWS)[number];

export type MilestoneStatus = "open" | "pending" | "confirmed" | "rejected";

export interface BoardCard {
  tripId: string;
  lane: string;
  status: string;
  label: string | null;
  codes: string[];
  origin: string | null;
  destination: string | null;
  truck: string | null;
  trailer: string | null;
  driver: string | null;
  secondDriver: string | null;
  carrier: string | null;
  plannedStart: string | null;
  plannedArrival: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  actualEnd: string | null;
  currentStage: string | null;
  milestones: Partial<
    Record<"departure" | "arrival" | "closure", MilestoneStatus>
  >;
  alerts: string[];
  monitorKey: string | null;
  regularized: boolean;
  cancelReason: string | null;
  updatedAt: string | null;
}

export interface BoardLane {
  key: string;
  count: number;
  cards: BoardCard[];
}

export interface BoardView {
  view: BoardViewKey;
  lanes: BoardLane[];
  at: string;
}

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;

/** A filter bar bound (`YYYY-MM-DD HH:mm:ss`, local time) as an ISO instant. */
function instant(bound: string | null): string | null {
  if (!bound) return null;
  const date = new Date(bound.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The board's query string from the page's: `q`, and the finished view's date range. */
export function boardQuery(
  view: BoardViewKey,
  search: URLSearchParams
): string {
  const query = new URLSearchParams();
  const q = search.get("q");
  if (q) query.set("q", q);
  if (view === "finished") {
    const from = instant(search.get("date_range_from"));
    const to = instant(search.get("date_range_to"));
    if (from) query.set("from", from);
    if (to) query.set("to", to);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function boardKey(view: BoardViewKey, search: URLSearchParams) {
  return `${API}/board/${view}${boardQuery(view, search)}`;
}

export function useTripsBoard(view: BoardViewKey, search: URLSearchParams) {
  return useSWR<BoardView>(
    boardKey(view, search),
    (url: string) => tripsRequest<BoardView>(url),
    { refreshInterval: 30_000, keepPreviousData: true }
  );
}

/** The board page that shows a lane. */
export const LANE_VIEW: Record<string, BoardViewKey> = {
  unassigned: "planning",
  scheduled: "planning",
  departure_pending: "planning",
  in_transit: "dispatch",
  arrival_pending: "dispatch",
  unloading: "delivery",
  closure_pending: "delivery",
  completed: "finished",
  regularized: "finished",
  cancelled: "finished",
};

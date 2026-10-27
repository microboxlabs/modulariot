"use client";

/**
 * Client for the trip milestones API (`/trips/milestones/pending`,
 * `/trips/{id}/milestones/...`) through the `/api/trips/*` proxy.
 */

import useSWR, { mutate } from "swr";
import { tripsRequest, type Milestone } from "../monitors/monitors-api";

export const MILESTONE_CONFIRM = "trips:milestone.confirm";

export interface TripMilestone {
  tripId: string;
  milestone: Milestone;
  status: "open" | "pending" | "confirmed" | "rejected";
  source: string | null;
  proposedAt: string | null;
  evidence: Record<string, unknown>;
  confirmedAt: string | null;
  confirmedBy: string | null;
  channel: string | null;
}

export interface PendingMilestone {
  milestone: TripMilestone;
  serviceCode: string | null;
  origin: string | null;
  destination: string | null;
  plannedStart: string | null;
}

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;
export const pendingKey = `${API}/milestones/pending`;

export function usePendingMilestones() {
  return useSWR<PendingMilestone[]>(
    pendingKey,
    (url: string) => tripsRequest<PendingMilestone[]>(url),
    { refreshInterval: 30_000 }
  );
}

function milestoneUrl(m: TripMilestone, verb: "confirm" | "reject") {
  return `${API}/${encodeURIComponent(m.tripId)}/milestones/${m.milestone}/${verb}`;
}

/** Confirms at the time the detection proposed. */
export async function confirmMilestone(m: TripMilestone) {
  await tripsRequest(milestoneUrl(m, "confirm"), {
    method: "POST",
    body: {
      channel: "ui",
      expectedDetection: { proposedAt: m.proposedAt, source: m.source },
    },
  });
  await mutate(pendingKey);
}

export async function rejectMilestone(m: TripMilestone, note: string | null) {
  await tripsRequest(milestoneUrl(m, "reject"), {
    method: "POST",
    body: {
      channel: "ui",
      note,
      expectedDetection: { proposedAt: m.proposedAt, source: m.source },
    },
  });
  await mutate(pendingKey);
}

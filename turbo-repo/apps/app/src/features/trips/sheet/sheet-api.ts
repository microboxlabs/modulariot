"use client";

/** Client for one trip's page (`/trips/board/sheet/{id}`) and its milestone actions, through `/api/trips/*`. */

import useSWR, { mutate } from "swr";
import { tripsRequest } from "../monitors/monitors-api";
import type { BoardCard } from "../board/board-api";
import type { TripMilestone } from "../milestones/milestones-api";
import type { TripDeliveries } from "../deliveries/deliveries-api";

export interface SheetStage {
  id: string;
  seq: number;
  stageType: string;
  serviceStatus: string | null;
  status: "pending" | "in_progress" | "completed";
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
}

export interface SheetTransition {
  id: number;
  monitorKey: string;
  monitorVersion: number;
  event: { on?: string; kind?: string; actor?: string; at?: string };
  matched: string[];
  ruleKey: string | null;
  fromStage: string | null;
  toStage: string | null;
  actions: { type?: string; value?: string; rule?: string }[];
  error: string | null;
  at: string;
}

export interface SheetFeed {
  feedKey: string;
  externalCode: string;
  source: Record<string, unknown>;
  lastAction: string | null;
  lastResult: string | null;
  lastReconciledAt: string | null;
}

/** A check of the driver that an external system reported, in force today. */
export interface DriverValidation {
  type: string;
  key: string;
  value: string | null;
  source: string | null;
  validUntil: string | null;
}

export interface SheetDriver {
  name: string | null;
  rut: string | null;
  phone: string | null;
  validations: DriverValidation[];
}

/** The trip's orders, first two drivers, carrier and the types of its origin and destination. */
export interface TripDetails {
  orders: { code: string; orderType: string | null; orderRef: string | null }[];
  drivers: SheetDriver[];
  carrier: { name: string; rut: string | null; code: string | null } | null;
  originType: string | null;
  destinationType: string | null;
}

export interface TripSheet {
  card: BoardCard;
  stages: SheetStage[];
  milestones: TripMilestone[];
  /** Milestone → id of the team that confirms it; a milestone without one is open to the permission. */
  confirmers: Partial<Record<TripMilestone["milestone"], string>>;
  transitions: SheetTransition[];
  feed: SheetFeed | null;
  deliveries: TripDeliveries | null;
  details: TripDetails | null;
}

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;

export function sheetKey(tripId: string) {
  return `${API}/board/sheet/${encodeURIComponent(tripId)}`;
}

export function useTripSheet(tripId: string) {
  return useSWR<TripSheet>(
    sheetKey(tripId),
    (url: string) => tripsRequest<TripSheet>(url),
    { refreshInterval: 30_000, keepPreviousData: true }
  );
}

function milestoneUrl(m: TripMilestone, verb: "confirm" | "reject") {
  return `${API}/${encodeURIComponent(m.tripId)}/milestones/${m.milestone}/${verb}`;
}

/** Confirms a pending detection at its proposed time, or records an open milestone at `at`. */
export async function confirm(m: TripMilestone, at: string | null) {
  await tripsRequest(milestoneUrl(m, "confirm"), {
    method: "POST",
    body:
      m.status === "pending"
        ? {
            channel: "ui",
            expectedDetection: { proposedAt: m.proposedAt, source: m.source },
          }
        : { channel: "ui", at },
  });
  await mutate(sheetKey(m.tripId));
}

export async function reject(m: TripMilestone, note: string | null) {
  await tripsRequest(milestoneUrl(m, "reject"), {
    method: "POST",
    body: {
      channel: "ui",
      note,
      expectedDetection: { proposedAt: m.proposedAt, source: m.source },
    },
  });
  await mutate(sheetKey(m.tripId));
}

"use client";

/** Client for a trip's deliveries (`/trips/{id}/deliveries`): proofs (POD) and steps, through `/api/trips/*`. */

import { mutate } from "swr";
import { tripsRequest } from "../monitors/monitors-api";
import { sheetKey } from "../sheet/sheet-api";
import type { MilestoneStatus } from "../board/board-api";

export const DELIVERY_OPERATE = "trips:delivery.operate";
export const DELIVERY_STEPS = ["delivered", "accepted", "settled"] as const;
export type DeliveryStepName = (typeof DELIVERY_STEPS)[number];
export const PROOF_KINDS = ["signature", "photo", "document", "other"] as const;
export type ProofKind = (typeof PROOF_KINDS)[number];

export interface DeliveryCycle {
  steps: DeliveryStepName[];
  completesTrip: DeliveryStepName | null;
  proofRequired: boolean;
  confirmOnProof: boolean;
}

export interface DeliveryStep {
  step: DeliveryStepName;
  status: MilestoneStatus;
  source: string | null;
  proposedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  channel: string | null;
  note: string | null;
}

export interface DeliveryProof {
  id: string;
  kind: ProofKind;
  contentId: string | null;
  url: string | null;
  name: string | null;
  mimetype: string | null;
  source: string | null;
  receivedAt: string;
  receivedBy: string | null;
}

export interface Delivery {
  id: string;
  reference: string | null;
  customer: string | null;
  source: string | null;
  mandates: { id: string; code: string | null }[];
  steps: DeliveryStep[];
  proofs: DeliveryProof[];
  createdAt: string;
}

export interface TripDeliveries {
  cycle: DeliveryCycle;
  deliveries: Delivery[];
  uncovered: { id: string; code: string }[];
}

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;

function deliveries(tripId: string) {
  return `${API}/${encodeURIComponent(tripId)}/deliveries`;
}

export async function createDelivery(
  tripId: string,
  body: {
    customer: string | null;
    reference: string | null;
    mandates: string[];
  }
) {
  await tripsRequest(deliveries(tripId), { method: "POST", body });
  await mutate(sheetKey(tripId));
}

/** Uploads a POD file (image or PDF). */
export async function stepAction(
  tripId: string,
  deliveryId: string,
  step: DeliveryStepName,
  verb: "confirm" | "reject"
) {
  await tripsRequest(
    `${deliveries(tripId)}/${encodeURIComponent(deliveryId)}/steps/${step}/${verb}`,
    { method: "POST", body: { channel: "ui" } }
  );
  await mutate(sheetKey(tripId));
}

/** Where the browser opens a proof: its stored file, or the link it came with. */
export function proofHref(tripId: string, proof: DeliveryProof) {
  if (!proof.contentId) return proof.url;
  const query = new URLSearchParams({ trip: tripId, proof: proof.id });
  return `${API}/proofs/content?${query}`;
}

/** The step a person can act on: the first one not confirmed, when the one before it is. */
export function nextStep(delivery: Delivery): DeliveryStep | null {
  for (let i = 0; i < delivery.steps.length; i++) {
    const s = delivery.steps[i];
    if (s.status !== "confirmed") {
      return i === 0 || delivery.steps[i - 1].status === "confirmed" ? s : null;
    }
  }
  return null;
}

"use client";

/**
 * Client for the trip feeds API (`/trips/feeds`) through the `/api/trips/*` proxy: each feed's
 * rules and how many of its services are open.
 */

import useSWR, { mutate } from "swr";
import {
  scopeValuesKey,
  tripsRequest,
  type StagePlan,
} from "../monitors/monitors-api";

export const FEED_ADMIN = "trips:feed.admin";

export const FEED_RESOURCES = ["truck", "trailer", "driver"] as const;
export type FeedResource = (typeof FEED_RESOURCES)[number];

export interface Feed {
  feedKey: string;
  name: string;
  stages: StagePlan[];
  arrivalStage: string;
  requiredResources: FeedResource[];
  active: boolean;
  openServices: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** What the form sends; the key goes in the path. */
export type FeedBody = Pick<
  Feed,
  "name" | "stages" | "arrivalStage" | "requiredResources" | "active"
>;

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;
export const feedsKey = `${API}/feeds`;

export function useFeeds() {
  return useSWR<Feed[]>(feedsKey, (url: string) => tripsRequest<Feed[]>(url));
}

/** Creates or replaces the feed's rules. */
export async function saveFeed(feedKey: string, body: FeedBody) {
  const saved = await tripsRequest<Feed>(
    `${feedsKey}/${encodeURIComponent(feedKey)}`,
    { method: "PUT", body }
  );
  await Promise.all([mutate(feedsKey), mutate(scopeValuesKey)]);
  return saved;
}

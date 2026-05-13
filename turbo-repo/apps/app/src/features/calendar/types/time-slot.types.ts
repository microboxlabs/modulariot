import type { TimeWindowColor } from "../components/planning/planning-selection-context";

/**
 * Re-export the canonical TimeSlot/TimeWindow/TimeBlock from the planning-selection context so there
 * is a single source of truth — the two definitions can't drift apart (and aren't flagged as duplicate code).
 */
export type {
  TimeSlot,
  TimeWindow,
  TimeBlock,
} from "../components/planning/planning-selection-context";

/**
 * Request/Response types for API operations
 */
export interface CreateTimeSlotRequest {
  name: string;
  kind: "window" | "block";
  type: "weekly" | "daily-override";
  weeklyPattern?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  quota?: number;
  color?: TimeWindowColor;
}

export interface UpdateTimeSlotRequest {
  id: string;
  name?: string;
  kind?: "window" | "block";
  type?: "weekly" | "daily-override";
  weeklyPattern?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  quota?: number;
  color?: TimeWindowColor;
}

export interface TimeSlotResponse {
  id: string;
  name: string;
  kind: "window" | "block";
  type: "weekly" | "daily-override";
  weeklyPattern?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  quota?: number;
  color?: TimeWindowColor;
}

export interface TimeSlotListResponse {
  data: TimeSlotResponse[];
  total?: number;
}

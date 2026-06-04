import type { TimeWindowColor } from "@microboxlabs/miot-calendar-ui";

/**
 * Re-export the canonical TimeSlot/TimeWindow/TimeBlock from the calendar UI
 * package so there is a single source of truth — the definitions can't drift
 * apart (and aren't flagged as duplicate code).
 */
export type {
  TimeSlot,
  TimeWindow,
  TimeBlock,
} from "@microboxlabs/miot-calendar-ui";

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

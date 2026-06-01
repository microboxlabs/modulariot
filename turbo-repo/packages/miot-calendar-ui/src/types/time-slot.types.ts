import type { TimeWindowColor } from "../components/planning/time-window";

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

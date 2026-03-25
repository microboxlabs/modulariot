import type { TimeWindowColor } from "../components/planning/planning-selection-context";

/**
 * Unified time slot - one interface for both windows and blocks
 * Maps directly to a single database table
 */
export interface TimeSlot {
  id: string;
  name: string;
  kind: "window" | "block"; // Discriminant
  type: "weekly" | "daily-override"; // Pattern type
  weeklyPattern?: string; // For weekly: "W1-4 1-5 0900-1700"
  startTimestamp?: string; // For daily-override: ISO 8601 format
  endTimestamp?: string; // For daily-override: ISO 8601 format
  quota?: number; // Used when kind="window"
  color?: TimeWindowColor; // Optional visual color
}

/**
 * Type aliases for backward compatibility
 */
export type TimeWindow = TimeSlot & { kind: "window"; quota: number };
export type TimeBlock = TimeSlot & { kind: "block" };

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

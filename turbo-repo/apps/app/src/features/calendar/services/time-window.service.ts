import type { TimeWindowRequest } from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import type {
  TimeSlot,
  TimeWindowColor,
} from "../components/planning/planning-selection-context";
import dayjs from "dayjs";

export const TimeWindowResponseSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  name: z.string(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  slotDurationMinutes: z.number(),
  capacity: z.number(),
  daysOfWeek: z.string().regex(/^[\d,-]+$/).min(1).nullish(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  active: z.boolean(),
  color: z.string().nullish(),
  // Defaulted server-side to WINDOW; older deployments that haven't shipped
  // the discriminator yet are tolerated via the default.
  kind: z.enum(["WINDOW", "BLOCK"]).default("WINDOW"),
  // Defaulted to AUTO so pre-v0.5.0 backends (no slotGenerationMode) keep working.
  slotGenerationMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  // Derived counts; optional so older backends that don't return them don't break the parse.
  totalSlots: z.number().int().nonnegative().optional(),
  bookableSlots: z.number().int().nonnegative().optional(),
});

type ValidatedTimeWindowResponse = z.infer<typeof TimeWindowResponseSchema>;

/**
 * Parse a comma-or-range string like "1,2,3,4,5" or "1-5" into a number array.
 */
function parseDaysString(daysStr: string): number[] {
  const result: number[] = [];
  for (const part of daysStr.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number);
      if (Number.isInteger(start) && Number.isInteger(end) && start <= end) {
        for (let i = start; i <= end; i++) result.push(i);
      }
    } else {
      const n = Number(trimmed);
      if (Number.isInteger(n)) result.push(n);
    }
  }
  return result;
}

/**
 * Format a sorted number array as a compact range string.
 * e.g. [1,2,3,4,5] → "1-5",  [1,3,5] → "1,3,5"
 */
function formatDaysRangeString(nums: number[]): string {
  if (nums.length === 0) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const isRange =
    sorted.length > 1 &&
    sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  return isRange ? `${sorted[0]}-${sorted.at(-1)}` : sorted.join(",");
}

/** Format an integer hour as a HHMM string (e.g. 9 → "0900", 17 → "1700"). */
function hourToHHMM(hour: number): string {
  return `${hour.toString().padStart(2, "0")}00`;
}

/**
 * Convert an API TimeWindowResponse to the app's local TimeSlot format.
 *
 * Convention:
 *  - If validFrom === validTo → "daily-override" (specific-date window)
 *  - Otherwise              → "weekly" (recurring weekly pattern)
 *
 * The API `kind` (WINDOW | BLOCK) maps directly to the local discriminant
 * (window | block); BLOCK rows carry capacity = 0 from the backend.
 */
export function apiToLocalTimeWindow(
  response: ValidatedTimeWindowResponse
): TimeSlot {
  const isDailyOverride =
    Boolean(response.validTo) && response.validFrom === response.validTo;

  const color = (response.color as TimeWindowColor | undefined) ?? "emerald";
  const localKind = response.kind === "BLOCK" ? "block" : "window";
  const slotGenerationMode =
    response.slotGenerationMode === "MANUAL" ? "manual" : "auto";

  if (isDailyOverride) {
    const startTs = `${response.validFrom}T${response.startHour.toString().padStart(2, "0")}:00:00`;
    const endTs = `${response.validTo ?? response.validFrom}T${response.endHour.toString().padStart(2, "0")}:00:00`;
    return {
      id: response.id,
      name: response.name,
      kind: localKind,
      type: "daily-override",
      startTimestamp: startTs,
      endTimestamp: endTs,
      quota: response.capacity,
      color,
      slotDurationMinutes: response.slotDurationMinutes,
      slotGenerationMode,
      totalSlots: response.totalSlots,
      bookableSlots: response.bookableSlots,
    };
  }

  // Weekly window: build pattern string "W* <days> <startHHMM>-<endHHMM>"
  const days = response.daysOfWeek
    ? parseDaysString(response.daysOfWeek)
    : [1, 2, 3, 4, 5];
  const daysStr = formatDaysRangeString(days);
  const weeklyPattern = `W* ${daysStr} ${hourToHHMM(response.startHour)}-${hourToHHMM(response.endHour)}`;

  return {
    id: response.id,
    name: response.name,
    kind: localKind,
    type: "weekly",
    weeklyPattern,
    quota: response.capacity,
    color,
    slotDurationMinutes: response.slotDurationMinutes,
    slotGenerationMode,
    totalSlots: response.totalSlots,
    bookableSlots: response.bookableSlots,
  };
}

/**
 * Slot-generation fields for a TimeWindowRequest. BLOCK windows ignore them server-side, so send
 * nothing; for WINDOWs send the mode ("auto" → "AUTO") and, only in manual mode, the admin-set duration.
 */
function slotGenerationRequestFields(
  slot: TimeSlot
): Pick<TimeWindowRequest, "slotGenerationMode" | "slotDurationMinutes"> {
  if (slot.kind === "block") return {};
  const slotGenerationMode =
    slot.slotGenerationMode === "manual" ? "MANUAL" : "AUTO";
  if (slotGenerationMode === "MANUAL" && slot.slotDurationMinutes != null) {
    return { slotGenerationMode, slotDurationMinutes: slot.slotDurationMinutes };
  }
  return { slotGenerationMode };
}

/**
 * Convert the app's local TimeSlot to an API TimeWindowRequest.
 *
 * @param slot      - The local time slot to convert.
 * @param validFrom - Optional override for the effective-from date (YYYY-MM-DD).
 *                    Defaults to today for weekly windows.
 */
export function localToApiTimeWindow(
  slot: TimeSlot,
  validFrom?: string
): TimeWindowRequest {
  const apiKind = slot.kind === "block" ? "BLOCK" : "WINDOW";
  // Blocks have no quota — the backend ignores capacity for BLOCK rows but
  // requires a non-negative number; send 0 explicitly.
  const capacity = slot.kind === "block" ? 0 : slot.quota ?? 1;
  const generationFields = slotGenerationRequestFields(slot);

  if (slot.type === "daily-override") {
    const start = slot.startTimestamp ? dayjs(slot.startTimestamp) : dayjs();
    const end = slot.endTimestamp
      ? dayjs(slot.endTimestamp)
      : dayjs().add(1, "hour");
    const dateStr = start.format("YYYY-MM-DD");
    // Day of week: JS 0=Sunday → format 1=Monday…7=Sunday
    const jsDay = start.day();
    const formatDay = jsDay === 0 ? 7 : jsDay;
    return {
      name: slot.name || "Time Window",
      startHour: start.hour(),
      endHour: end.hour(),
      validFrom: dateStr,
      validTo: dateStr,
      daysOfWeek: String(formatDay),
      capacity,
      active: true,
      color: slot.color,
      kind: apiKind,
      ...generationFields,
    };
  }

  // Weekly type: parse weeklyPattern "W* 1-5 0900-1700"
  const pattern = slot.weeklyPattern ?? "W* 1-5 0900-1700";
  const match = /^W(?:\*|[\d,-]+)\s+([\d,-]+)\s+(\d{4})-(\d{4})$/.exec(pattern);

  if (!match) {
    return {
      name: slot.name || "Time Window",
      startHour: 9,
      endHour: 17,
      validFrom: validFrom ?? dayjs().format("YYYY-MM-DD"),
      daysOfWeek: "1,2,3,4,5",
      capacity,
      active: true,
      color: slot.color,
      kind: apiKind,
      ...generationFields,
    };
  }

  const [, daysStr, startTime, endTime] = match;
  const days = parseDaysString(daysStr);
  const startHour = Number.parseInt(startTime.slice(0, 2), 10);
  const endHour = Number.parseInt(endTime.slice(0, 2), 10);

  return {
    name: slot.name || "Time Window",
    startHour,
    endHour,
    validFrom: validFrom ?? dayjs().format("YYYY-MM-DD"),
    daysOfWeek: days.join(","),
    capacity,
    active: true,
    color: slot.color,
    kind: apiKind,
    ...generationFields,
  };
}

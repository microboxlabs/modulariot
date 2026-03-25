// --- Enum ---

export type SlotStatus = "OPEN" | "FULL" | "CLOSED";

// --- Shared data types ---

export interface ResourceData {
  id: string;
  type?: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface SlotData {
  date: string;
  hour: number;
  minutes: number;
}

// --- Bookings ---

export interface BookingRequest {
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
}

export interface BookingResponse {
  id: string;
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
  createdAt: string;
  createdBy?: string;
}

export interface BookingListResponse {
  data: BookingResponse[];
  total: number;
}

// --- Calendar Groups ---

export interface CalendarGroupRequest {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface CalendarGroupResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Calendars ---

export interface CalendarRequest {
  code: string;
  name: string;
  description?: string;
  timezone?: string;
  active?: boolean;
  parallelism?: number;
  groups?: string[];
  autoSlotManager?: boolean;
}

export interface CalendarResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  timezone: string;
  active: boolean;
  parallelism: number;
  createdAt: string;
  updatedAt: string;
  groups?: CalendarGroupResponse[];
  hasSlotManager?: boolean;
}

// --- Time Windows ---

export interface TimeWindowRequest {
  name: string;
  startHour: number;
  endHour: number;
  validFrom: string;
  capacity?: number;
  daysOfWeek?: string;
  validTo?: string;
  active?: boolean;
}

export interface TimeWindowResponse {
  id: string;
  calendarId: string;
  name: string;
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  capacity: number;
  daysOfWeek: string;
  validFrom: string;
  validTo?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Slots ---

export interface GenerateSlotsRequest {
  calendarId: string;
  startDate: string;
  endDate: string;
}

export interface GenerateSlotsResponse {
  slotsCreated: number;
  slotsSkipped: number;
  message: string;
}

export interface SlotResponse {
  id: string;
  calendarId: string;
  timeWindowId?: string;
  slotDate: string;
  slotHour: number;
  slotMinutes: number;
  capacity: number;
  currentOccupancy: number;
  availableCapacity: number;
  status: SlotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SlotListResponse {
  data: SlotResponse[];
  total: number;
}

export interface UpdateSlotStatusRequest {
  status: SlotStatus;
}

// --- Slot Managers ---

export interface SlotManagerRequest {
  calendarId: string;
  active?: boolean;
  daysInAdvance?: number;
  batchDays?: number;
  reprocessFrom?: string;
  reprocessTo?: string;
}

export interface SlotManagerResponse {
  id: string;
  calendarId: string;
  calendarCode: string;
  calendarName: string;
  active: boolean;
  daysInAdvance: number;
  batchDays: number;
  reprocessFrom?: string;
  reprocessTo?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
  generatedThrough?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlotManagerRunResponse {
  id: string;
  managerId: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  slotsCreated: number;
  slotsSkipped: number;
  generatedFrom?: string;
  generatedThrough?: string;
  errorMessage?: string;
}

// --- Error ---

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

// --- Client config ---

export interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

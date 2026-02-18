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

// --- Calendars ---

export interface CalendarRequest {
  code: string;
  name: string;
  description?: string;
  timezone?: string;
  active?: boolean;
}

export interface CalendarResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Time Windows ---

export interface TimeWindowRequest {
  name: string;
  startHour: number;
  endHour: number;
  validFrom: string;
  slotDurationMinutes?: number;
  capacityPerSlot?: number;
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
  capacityPerSlot: number;
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

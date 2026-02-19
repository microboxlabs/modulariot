# @microboxlabs/miot-calendar-client

[![npm](https://img.shields.io/npm/v/@microboxlabs/miot-calendar-client)](https://www.npmjs.com/package/@microboxlabs/miot-calendar-client)
[![License](https://img.shields.io/npm/l/@microboxlabs/miot-calendar-client)](./LICENSE)

TypeScript client for the ModularIoT Calendar API. Zero dependencies — uses the native `fetch` API.

## Installation

```bash
npm install @microboxlabs/miot-calendar-client
```

## Quick Start

A complete workflow: create a calendar, define a time window, generate slots, and book one.

```ts
import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";

const client = createMiotCalendarClient({
  baseUrl: "https://your-api-host.com",
});

// 1. Create a calendar
const calendar = await client.calendars.create({
  code: "maintenance",
  name: "Vehicle Maintenance",
  timezone: "America/New_York", // defaults to "UTC" if omitted
});

// 2. Add a time window (Mon–Fri, 8 AM – 5 PM, 30-min slots)
const timeWindow = await client.calendars.createTimeWindow(calendar.id, {
  name: "Business Hours",
  startHour: 8,
  endHour: 17,
  validFrom: "2026-03-01",
  daysOfWeek: "1,2,3,4,5",        // Mon–Fri
  slotDurationMinutes: 30,         // default: 30
  capacityPerSlot: 2,              // default: 1
});

// 3. Generate slots for the first two weeks
const result = await client.slots.generate({
  calendarId: calendar.id,
  startDate: "2026-03-01",
  endDate: "2026-03-14",           // max range: 90 days
});
console.log(`Created ${result.slotsCreated} slots`);

// 4. Find available slots
const { data: slots } = await client.slots.list({
  calendarId: calendar.id,         // required
  available: true,
  startDate: "2026-03-03",
  endDate: "2026-03-07",
});

// 5. Book the first available slot
const booking = await client.bookings.create(
  {
    calendarId: calendar.id,
    resource: { id: "truck-42", type: "vehicle", label: "Truck 42" },
    slot: { date: slots[0].slotDate, hour: slots[0].slotHour, minutes: slots[0].slotMinutes },
  },
  { userId: "user-abc" },          // sets X-User-Id header → stored as createdBy
);
```

## Configuration

```ts
const client = createMiotCalendarClient({
  baseUrl: "https://your-api-host.com",  // Required — API base URL
  headers: { Authorization: "Bearer ..." }, // Optional — merged into every request
  fetch: customFetch,                       // Optional — custom fetch implementation
});
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | `string` | Yes | Base URL of the Calendar API |
| `headers` | `Record<string, string>` | No | Default headers sent with every request |
| `fetch` | `typeof fetch` | No | Custom `fetch` implementation (defaults to `globalThis.fetch`) |

## API Reference

### Calendars

#### `calendars.list(params?)`

List all calendars, optionally filtered by active status or group membership.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `active` | `boolean` | No | Filter by active status |
| `groupCode` | `string` | No | Filter calendars belonging to this group code |

**Returns:** `CalendarResponse[]`

#### `calendars.get(id)`

Get a single calendar by ID.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Calendar ID |

**Returns:** `CalendarResponse`

**Throws:** `MiotCalendarApiError` with status `404` if not found.

#### `calendars.create(body)`

Create a new calendar.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | `string` | Yes | — | Unique code identifier |
| `name` | `string` | Yes | — | Display name |
| `description` | `string` | No | — | Optional description |
| `timezone` | `string` | No | `"UTC"` | IANA timezone |
| `active` | `boolean` | No | `true` | Whether the calendar is active |
| `groups` | `string[]` | No | — | Group codes to assign. `null` = no change; `[]` = remove all; `["code"]` = replace all |

**Returns:** `CalendarResponse`

#### `calendars.update(id, body)`

Replace a calendar's fields. Takes the same body as `create`.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Calendar ID |
| `body` | `CalendarRequest` | Yes | Updated calendar data (include `groups` to reassign group membership) |

**Returns:** `CalendarResponse`

#### `calendars.deactivate(id)`

Deactivate a calendar (soft delete).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Calendar ID |

**Returns:** `void` (HTTP 204 — no content)

---

### Time Windows

Time windows are managed through the `calendars` namespace.

#### `calendars.listTimeWindows(calendarId)`

List all time windows for a calendar.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | `string` | Yes | Calendar ID |

**Returns:** `TimeWindowResponse[]`

#### `calendars.createTimeWindow(calendarId, body)`

Create a time window within a calendar.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | Time window name |
| `startHour` | `number` | Yes | — | Start hour (0–23) |
| `endHour` | `number` | Yes | — | End hour (0–23, must be > startHour) |
| `validFrom` | `string` | Yes | — | Start date (`YYYY-MM-DD`) |
| `validTo` | `string` | No | — | End date (`YYYY-MM-DD`) |
| `slotDurationMinutes` | `number` | No | `30` | Slot duration in minutes |
| `capacityPerSlot` | `number` | No | `1` | Max bookings per slot |
| `daysOfWeek` | `string` | No | — | Comma-separated days (1=Mon … 7=Sun) |
| `active` | `boolean` | No | `true` | Whether the time window is active |

**Returns:** `TimeWindowResponse`

#### `calendars.updateTimeWindow(calendarId, timeWindowId, body)`

Update a time window. Takes the same body as `createTimeWindow`.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | `string` | Yes | Calendar ID |
| `timeWindowId` | `string` | Yes | Time window ID |
| `body` | `TimeWindowRequest` | Yes | Updated time window data |

**Returns:** `TimeWindowResponse`

---

### Groups

Calendar groups let you organize calendars into named collections. Calendars can belong to multiple groups; use `CalendarRequest.groups` on create or update to manage membership.

#### `groups.list(params?)`

List all calendar groups, optionally filtered by active status.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `active` | `boolean` | No | Filter by active status |

**Returns:** `CalendarGroupResponse[]`

#### `groups.get(id)`

Get a single calendar group by ID.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Group ID |

**Returns:** `CalendarGroupResponse`

**Throws:** `MiotCalendarApiError` with status `404` if not found.

#### `groups.create(body)`

Create a new calendar group.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | `string` | Yes | — | Unique code identifier (max 50 chars) |
| `name` | `string` | Yes | — | Display name (max 255 chars) |
| `description` | `string` | No | — | Optional description |
| `active` | `boolean` | No | `true` | Whether the group is active |

**Returns:** `CalendarGroupResponse`

**Throws:** `MiotCalendarApiError` with status `400` if the code is already taken.

#### `groups.update(id, body)`

Replace a calendar group's fields. Takes the same body as `create`.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Group ID |
| `body` | `CalendarGroupRequest` | Yes | Updated group data |

**Returns:** `CalendarGroupResponse`

#### `groups.deactivate(id)`

Deactivate a calendar group (soft delete). Calendars in the group are not affected.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Group ID |

**Returns:** `void` (HTTP 204 — no content)

---

### Slots

#### `slots.list(params)`

List slots for a calendar. The `calendarId` parameter is **required**.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `calendarId` | `string` | Yes | — | Calendar ID |
| `available` | `boolean` | No | — | Filter by availability |
| `startDate` | `string` | No | today | Start of date range (`YYYY-MM-DD`) |
| `endDate` | `string` | No | today + 7 days | End of date range (`YYYY-MM-DD`) |

**Returns:** `SlotListResponse` — `{ data: SlotResponse[], total: number }`

#### `slots.get(id)`

Get a single slot by ID.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Slot ID |

**Returns:** `SlotResponse`

**Throws:** `MiotCalendarApiError` with status `404` if not found.

#### `slots.generate(body)`

Generate slots for a calendar based on its time windows.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | `string` | Yes | Calendar ID |
| `startDate` | `string` | Yes | Start date (`YYYY-MM-DD`) |
| `endDate` | `string` | Yes | End date (`YYYY-MM-DD`) |

> **Note:** The date range must not exceed **90 days**. The API returns `400 Bad Request` if the range is larger.

**Returns:** `GenerateSlotsResponse` — `{ slotsCreated: number, slotsSkipped: number, message: string }`

#### `slots.updateStatus(id, body)`

Manually change a slot's status.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Slot ID |
| `status` | `"OPEN" \| "CLOSED"` | Yes | New status |

> **Note:** Only `OPEN` and `CLOSED` are accepted. `FULL` is managed automatically by the system based on occupancy and cannot be set manually. Passing `FULL` returns `400 Bad Request`.

**Returns:** `SlotResponse`

---

### Bookings

#### `bookings.list(params?)`

List bookings, optionally filtered by calendar and date range.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `calendarId` | `string` | No | — | Filter by calendar |
| `startDate` | `string` | No | today | Start of date range (`YYYY-MM-DD`) |
| `endDate` | `string` | No | today + 30 days | End of date range (`YYYY-MM-DD`) |

**Returns:** `BookingListResponse` — `{ data: BookingResponse[], total: number }`

#### `bookings.get(id)`

Get a single booking by ID.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Booking ID |

**Returns:** `BookingResponse`

**Throws:** `MiotCalendarApiError` with status `404` if not found.

#### `bookings.create(body, options?)`

Create a booking for a specific slot.

**Body (`BookingRequest`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | `string` | Yes | Calendar ID |
| `resource` | `ResourceData` | Yes | The resource being booked |
| `slot` | `SlotData` | Yes | Target slot (date + time) |

**Options:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | No | Sets `X-User-Id` header — stored as `createdBy` in the response |

**Returns:** `BookingResponse`

**Throws:**

- `404` — Calendar or slot not found
- `409` — Slot is full (no available capacity)

#### `bookings.cancel(id)`

Cancel a booking.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Booking ID |

**Returns:** `void` (HTTP 204 — no content)

#### `bookings.listByResource(resourceId)`

List all bookings for a specific resource.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `resourceId` | `string` | Yes | Resource ID |

**Returns:** `BookingListResponse`

## Types

### `CalendarGroupRequest`

```ts
interface CalendarGroupRequest {
  code: string;           // Unique code identifier (max 50 chars)
  name: string;           // Display name (max 255 chars)
  description?: string;   // Optional description
  active?: boolean;       // Active status (default: true)
}
```

### `CalendarGroupResponse`

```ts
interface CalendarGroupResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
```

### `CalendarRequest`

```ts
interface CalendarRequest {
  code: string;           // Unique code identifier
  name: string;           // Display name
  description?: string;   // Optional description
  timezone?: string;      // IANA timezone (default: "UTC")
  active?: boolean;       // Active status (default: true)
  groups?: string[];      // Group codes to assign. null = no change; [] = remove all; ["code"] = replace all
}
```

### `CalendarResponse`

```ts
interface CalendarResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  timezone: string;                    // Always present (default: "UTC")
  active: boolean;                     // Always present (default: true)
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  groups?: CalendarGroupResponse[];    // Groups this calendar belongs to
}
```

### `TimeWindowRequest`

```ts
interface TimeWindowRequest {
  name: string;                 // Time window name
  startHour: number;            // 0–23
  endHour: number;              // 0–23 (must be > startHour)
  validFrom: string;            // YYYY-MM-DD
  validTo?: string;             // YYYY-MM-DD
  slotDurationMinutes?: number; // Default: 30
  capacityPerSlot?: number;     // Default: 1
  daysOfWeek?: string;          // Comma-separated: "1,2,3,4,5" (1=Mon, 7=Sun)
  active?: boolean;             // Default: true
}
```

### `TimeWindowResponse`

```ts
interface TimeWindowResponse {
  id: string;
  calendarId: string;
  name: string;
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;  // Always present (default: 30)
  capacityPerSlot: number;      // Always present (default: 1)
  daysOfWeek: string;
  validFrom: string;
  validTo?: string;
  active: boolean;              // Always present (default: true)
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

### `SlotResponse`

```ts
interface SlotResponse {
  id: string;
  calendarId: string;
  timeWindowId?: string;        // May be absent for manually created slots
  slotDate: string;             // YYYY-MM-DD
  slotHour: number;             // 0–23
  slotMinutes: number;          // 0–59
  capacity: number;             // Total capacity
  currentOccupancy: number;     // Current bookings count
  availableCapacity: number;    // capacity - currentOccupancy
  status: SlotStatus;           // "OPEN" | "FULL" | "CLOSED"
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

### `SlotListResponse`

```ts
interface SlotListResponse {
  data: SlotResponse[];
  total: number;
}
```

### `GenerateSlotsRequest`

```ts
interface GenerateSlotsRequest {
  calendarId: string;
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD (max 90 days from startDate)
}
```

### `GenerateSlotsResponse`

```ts
interface GenerateSlotsResponse {
  slotsCreated: number;
  slotsSkipped: number;
  message: string;
}
```

### `UpdateSlotStatusRequest`

```ts
interface UpdateSlotStatusRequest {
  status: SlotStatus;           // Only "OPEN" or "CLOSED" accepted
}
```

### `BookingRequest`

```ts
interface BookingRequest {
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
}
```

### `BookingResponse`

```ts
interface BookingResponse {
  id: string;
  calendarId: string;
  resource: ResourceData;
  slot: SlotData;
  createdAt: string;            // ISO 8601
  createdBy?: string;           // Set via X-User-Id header on create
}
```

### `BookingListResponse`

```ts
interface BookingListResponse {
  data: BookingResponse[];
  total: number;
}
```

### `ResourceData`

```ts
interface ResourceData {
  id: string;                            // Resource identifier
  type?: string;                         // Resource type (e.g. "vehicle", "room")
  label?: string;                        // Human-readable label
  data?: Record<string, unknown>;        // Arbitrary metadata
}
```

### `SlotData`

```ts
interface SlotData {
  date: string;     // YYYY-MM-DD
  hour: number;     // 0–23
  minutes: number;  // 0–59
}
```

### `SlotStatus`

```ts
type SlotStatus = "OPEN" | "FULL" | "CLOSED";
```

### `ErrorResponse`

```ts
interface ErrorResponse {
  error: string;      // Error type (e.g. "Bad Request")
  message: string;    // Detailed error message
  status: number;     // HTTP status code
  timestamp: string;  // ISO 8601
}
```

### `ClientConfig`

```ts
interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}
```

## Error Handling

All API errors throw `MiotCalendarApiError`.

```ts
import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";

try {
  await client.bookings.create({
    calendarId: "cal-123",
    resource: { id: "truck-42", type: "vehicle", label: "Truck 42" },
    slot: { date: "2026-03-01", hour: 10, minutes: 0 },
  });
} catch (error) {
  if (error instanceof MiotCalendarApiError) {
    console.log(error.status);   // HTTP status code (e.g. 409)
    console.log(error.message);  // Error message string
    console.log(error.body);     // ErrorResponse object or raw string
  }
}
```

### Error Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| `400` | Bad Request | Validation errors, slot generation range > 90 days, setting status to `FULL` manually |
| `404` | Not Found | Calendar, slot, or booking does not exist |
| `409` | Conflict | Slot is full (no available capacity for booking) |

### Error Body

The `body` property on `MiotCalendarApiError` can be either:

- An **`ErrorResponse` object** with `error`, `message`, `status`, and `timestamp` fields — returned when the API sends a JSON error response.
- A **plain `string`** — returned as a fallback when the API response is not valid JSON (e.g. gateway errors, load balancer timeouts).

```ts
if (error instanceof MiotCalendarApiError) {
  if (typeof error.body === "string") {
    // Non-JSON error (gateway, timeout, etc.)
    console.log("Raw error:", error.body);
  } else {
    // Structured API error
    console.log(error.body.error);     // "Conflict"
    console.log(error.body.message);   // "Slot is full"
    console.log(error.body.timestamp); // "2026-03-01T10:00:00Z"
  }
}
```

## Custom Fetch

Pass a custom `fetch` implementation for server-side rendering, auth interceptors, or testing.

### Auth interceptor

```ts
const client = createMiotCalendarClient({
  baseUrl: "https://your-api-host.com",
  fetch: async (input, init) => {
    const token = await getAccessToken(); // your auth logic
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return globalThis.fetch(input, { ...init, headers });
  },
});
```

### Testing with a mock fetch

```ts
import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";

const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  return new Response(JSON.stringify({ id: "cal-1", code: "test", name: "Test" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const client = createMiotCalendarClient({
  baseUrl: "https://mock-api",
  fetch: mockFetch,
});

const calendar = await client.calendars.get("cal-1");
```

## License

[Apache-2.0](./LICENSE)

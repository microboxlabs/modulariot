# @microboxlabs/miot-calendar-client

TypeScript client for the ModularIoT Calendar API. Zero dependencies — uses the native `fetch` API.

## Installation

```bash
npm install @microboxlabs/miot-calendar-client
```

## Quick Start

```ts
import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";

const client = createMiotCalendarClient({
  baseUrl: "https://your-api-host.com",
});

// List calendars
const calendars = await client.calendars.list();

// Create a booking
const booking = await client.bookings.create({
  calendarId: "cal-123",
  resource: { id: "truck-42", type: "vehicle", label: "Truck 42" },
  slot: { date: "2026-03-01", hour: 10, minutes: 0 },
});
```

## Configuration

```ts
createMiotCalendarClient({
  baseUrl: "https://your-api-host.com",  // Required
  headers: { Authorization: "Bearer ..." }, // Optional default headers
  fetch: customFetch,                       // Optional fetch implementation
});
```

## API Reference

### `client.calendars`

| Method | Description |
|---|---|
| `list(params?)` | List calendars. Filter by `active`. |
| `get(id)` | Get a calendar by ID. |
| `create(body)` | Create a calendar. |
| `update(id, body)` | Update a calendar. |
| `deactivate(id)` | Deactivate a calendar. |
| `listTimeWindows(calendarId)` | List time windows for a calendar. |
| `createTimeWindow(calendarId, body)` | Create a time window. |
| `updateTimeWindow(calendarId, timeWindowId, body)` | Update a time window. |

### `client.bookings`

| Method | Description |
|---|---|
| `list(params?)` | List bookings. Filter by `calendarId`, `startDate`, `endDate`. |
| `get(id)` | Get a booking by ID. |
| `create(body, options?)` | Create a booking. Pass `{ userId }` to set `X-User-Id` header. |
| `cancel(id)` | Cancel a booking. |
| `listByResource(resourceId)` | List bookings for a specific resource. |

### `client.slots`

| Method | Description |
|---|---|
| `list(params)` | List slots. Filter by `calendarId`, `available`, `startDate`, `endDate`. |
| `get(id)` | Get a slot by ID. |
| `generate(body)` | Generate slots for a date range. |
| `updateStatus(id, body)` | Update slot status (`OPEN`, `FULL`, `CLOSED`). |

## Error Handling

```ts
import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";

try {
  await client.bookings.get("non-existent");
} catch (error) {
  if (error instanceof MiotCalendarApiError) {
    console.log(error.status); // HTTP status code
    console.log(error.body);   // ErrorResponse object or raw string
  }
}
```

## License

[Apache-2.0](./LICENSE)

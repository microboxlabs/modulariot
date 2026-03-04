# miot-cli Calendar Module Reference

## Table of Contents

- [Global Options](#global-options)
- [calendar list](#miot-calendar-list)
- [calendar get](#miot-calendar-get)
- [calendar create](#miot-calendar-create)
- [calendar update](#miot-calendar-update)
- [calendar deactivate](#miot-calendar-deactivate)
- [calendar purge](#miot-calendar-purge)
- [slots list](#miot-calendar-slots-list)
- [slots get](#miot-calendar-slots-get)
- [slots generate](#miot-calendar-slots-generate)
- [slots update-status](#miot-calendar-slots-update-status)
- [bookings list](#miot-calendar-bookings-list)
- [bookings get](#miot-calendar-bookings-get)
- [bookings create](#miot-calendar-bookings-create)
- [bookings cancel](#miot-calendar-bookings-cancel)
- [bookings by-resource](#miot-calendar-bookings-by-resource)
- [groups list](#miot-calendar-groups-list)
- [groups get](#miot-calendar-groups-get)
- [groups create](#miot-calendar-groups-create)
- [groups update](#miot-calendar-groups-update)
- [groups deactivate](#miot-calendar-groups-deactivate)
- [time-windows list](#miot-calendar-time-windows-list)
- [time-windows create](#miot-calendar-time-windows-create)
- [time-windows update](#miot-calendar-time-windows-update)
- [slot-managers list](#miot-calendar-slot-managers-list)
- [slot-managers get](#miot-calendar-slot-managers-get)
- [slot-managers create](#miot-calendar-slot-managers-create)
- [slot-managers update](#miot-calendar-slot-managers-update)
- [slot-managers deactivate](#miot-calendar-slot-managers-deactivate)
- [slot-managers run](#miot-calendar-slot-managers-run)
- [slot-managers runs](#miot-calendar-slot-managers-runs)

---

## Global Options

These flags apply to every `miot` command:

| Flag | Type | Description |
|------|------|-------------|
| `--base-url <url>` | string | API base URL (or `MIOT_BASE_URL` env) |
| `--token <token>` | string | Auth token (or `MIOT_TOKEN` env) |
| `--profile <name>` | string | Named profile from `~/.miotrc.json` |
| `--output <mode>` | `json` \| `table` | Output format (default: `table` in TTY, `json` when piped) |

---

## miot calendar list

List all calendars.

| Flag | Type | Description |
|------|------|-------------|
| `--group <code>` | string | Filter by group code |
| `--active` | boolean | Show only active calendars |
| `--inactive` | boolean | Show only inactive calendars |

**JSON output:**

```json
[
  {
    "id": "cal_abc123",
    "code": "vehicle-inspection",
    "name": "Vehicle Inspection",
    "timezone": "America/New_York",
    "active": true,
    "hasSlotManager": true,
    "parallelism": 1
  }
]
```

---

## miot calendar get

`miot calendar get <id>`

Get a single calendar by ID.

**JSON output:**

```json
{
  "id": "cal_abc123",
  "code": "vehicle-inspection",
  "name": "Vehicle Inspection",
  "timezone": "America/New_York",
  "active": true,
  "hasSlotManager": true,
  "parallelism": 1
}
```

---

## miot calendar create

Create a new calendar.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--code <code>` | string | yes | Calendar code |
| `--name <name>` | string | yes | Calendar name |
| `--timezone <tz>` | string | no | Timezone |
| `--description <desc>` | string | no | Description |
| `--no-auto-slot-manager` | boolean | no | Skip auto-provisioning a default SlotManager on creation |
| `--parallelism <n>` | integer | no | Parallel resources per slot (default: 1) |

**JSON output:** Same shape as `calendar get`. When `--no-auto-slot-manager` is passed, `hasSlotManager` will be `false`.

---

## miot calendar update

`miot calendar update <id>`

Update an existing calendar.

| Flag | Type | Description |
|------|------|-------------|
| `--code <code>` | string | Update calendar code |
| `--name <name>` | string | Update calendar name |
| `--timezone <tz>` | string | Update timezone |
| `--description <desc>` | string | Update description |
| `--group <code>` | string | Assign to group by code (repeatable) |
| `--parallelism <n>` | integer | Parallel resources per slot (default: 1) |

**JSON output:** Same shape as `calendar get`.

---

## miot calendar deactivate

`miot calendar deactivate <id>`

Deactivate a calendar.

**JSON output:**

```json
{ "success": true }
```

---

## miot calendar purge

`miot calendar purge <id>`

**Permanently and irreversibly** delete a calendar and all its associated data: slots, bookings, time windows, and slot manager. This action cannot be undone.

**JSON output:**

```json
{ "success": true }
```

---

## miot calendar slots list

List slots for a calendar.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |
| `--from <date>` | string | no | Start date (YYYY-MM-DD) |
| `--to <date>` | string | no | End date (YYYY-MM-DD) |
| `--available` | boolean | no | Show only available (OPEN with capacity) slots |

**JSON output:**

```json
{
  "data": [
    {
      "id": "slot_xyz",
      "slotDate": "2025-06-15",
      "slotHour": 9,
      "slotMinutes": 0,
      "capacity": 3,
      "currentOccupancy": 1,
      "availableCapacity": 2,
      "status": "OPEN"
    }
  ]
}
```

---

## miot calendar slots get

`miot calendar slots get <id>`

Get a single slot by ID.

**JSON output:** Same shape as a single slot object from `slots list`.

---

## miot calendar slots generate

Generate slots from time windows.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |
| `--from <date>` | string | yes | Start date (YYYY-MM-DD) |
| `--to <date>` | string | yes | End date (YYYY-MM-DD) |

**Note:** Date range limited to 90 days maximum.

**JSON output:** Generation result object.

---

## miot calendar slots update-status

`miot calendar slots update-status <id>`

Change a slot's status.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--status <status>` | `OPEN` \| `CLOSED` | yes | New status |

**JSON output:** Updated slot object.

---

## miot calendar bookings list

List bookings.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | no | Filter by calendar ID |
| `--from <date>` | string | no | Start date (YYYY-MM-DD) |
| `--to <date>` | string | no | End date (YYYY-MM-DD) |

**JSON output:**

```json
{
  "data": [
    {
      "id": "bk_001",
      "calendarId": "cal_abc123",
      "resource": { "id": "vehicle-42" },
      "slot": { "date": "2025-06-15", "hour": 9, "minutes": 0 },
      "createdAt": "2025-06-10T14:30:00Z"
    }
  ]
}
```

---

## miot calendar bookings get

`miot calendar bookings get <id>`

Get a single booking by ID.

**JSON output:** Same shape as a single booking object from `bookings list`.

---

## miot calendar bookings create

Create a new booking.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |
| `--resource-id <id>` | string | yes | Resource ID |
| `--date <date>` | string | yes | Slot date (YYYY-MM-DD) |
| `--hour <hour>` | integer | yes | Slot hour (0–23) |
| `--minutes <minutes>` | integer | yes | Slot minutes (0–59) |
| `--resource-type <type>` | string | no | Resource type |
| `--resource-label <label>` | string | no | Resource label |

**JSON output:** Created booking object.

---

## miot calendar bookings cancel

`miot calendar bookings cancel <id>`

Cancel a booking.

**JSON output:**

```json
{ "success": true }
```

---

## miot calendar bookings by-resource

`miot calendar bookings by-resource <resourceId>`

List all bookings for a specific resource.

**JSON output:**

```json
{
  "data": [
    {
      "id": "bk_001",
      "calendarId": "cal_abc123",
      "slot": { "date": "2025-06-15", "hour": 9, "minutes": 0 },
      "createdAt": "2025-06-10T14:30:00Z"
    }
  ]
}
```

---

## miot calendar groups list

List calendar groups.

| Flag | Type | Description |
|------|------|-------------|
| `--active` | boolean | Show only active groups |

**JSON output:**

```json
[
  {
    "id": "grp_001",
    "code": "inspections",
    "name": "Inspections",
    "active": true
  }
]
```

---

## miot calendar groups get

`miot calendar groups get <id>`

Get a single group by ID.

**JSON output:** Same shape as a single group object from `groups list`.

---

## miot calendar groups create

Create a new group.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--code <code>` | string | yes | Group code |
| `--name <name>` | string | yes | Group name |
| `--description <desc>` | string | no | Description |

**JSON output:** Created group object.

---

## miot calendar groups update

`miot calendar groups update <id>`

Update a group.

| Flag | Type | Description |
|------|------|-------------|
| `--code <code>` | string | Update group code |
| `--name <name>` | string | Update group name |
| `--description <desc>` | string | Update description |

**JSON output:** Updated group object.

---

## miot calendar groups deactivate

`miot calendar groups deactivate <id>`

Deactivate a group.

**JSON output:**

```json
{ "success": true }
```

---

## miot calendar time-windows list

List time windows for a calendar.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |

**JSON output:**

```json
[
  {
    "id": "tw_001",
    "name": "Morning Shift",
    "startHour": 8,
    "endHour": 12,
    "slotDurationMinutes": 30,
    "capacity": 2,
    "daysOfWeek": "1,2,3,4,5",
    "validFrom": "2025-01-01",
    "validTo": "2025-12-31",
    "active": true
  }
]
```

---

## miot calendar time-windows create

Create a new time window.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |
| `--name <name>` | string | yes | Time window name |
| `--start-hour <hour>` | integer | yes | Start hour (0–23) |
| `--end-hour <hour>` | integer | yes | End hour (0–23, must be > start-hour) |
| `--valid-from <date>` | string | yes | Valid from date (YYYY-MM-DD) |
| `--valid-to <date>` | string | no | Valid to date (YYYY-MM-DD) |
| `--capacity <n>` | integer | no | Total capacity for the window |
| `--days-of-week <days>` | string | no | Days of week (e.g. `"1,2,3,4,5"`) |

**JSON output:** Created time window object.

---

## miot calendar time-windows update

`miot calendar time-windows update <calendarId> <timeWindowId>`

Update an existing time window.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | yes | Time window name |
| `--start-hour <hour>` | integer | yes | Start hour (0–23) |
| `--end-hour <hour>` | integer | yes | End hour (0–23) |
| `--valid-from <date>` | string | yes | Valid from date (YYYY-MM-DD) |
| `--valid-to <date>` | string | no | Valid to date (YYYY-MM-DD) |
| `--capacity <n>` | integer | no | Total capacity for the window |
| `--days-of-week <days>` | string | no | Days of week (e.g. `"1,2,3,4,5"`) |

**JSON output:** Updated time window object.

---

## miot calendar slot-managers list

List slot managers.

| Flag | Type | Description |
|------|------|-------------|
| `--active` | boolean | Show only active managers |

**JSON output:**

```json
[
  {
    "id": "sm_001",
    "calendarCode": "vehicle-inspection",
    "active": true,
    "daysInAdvance": 30,
    "batchDays": 7,
    "lastRunAt": "2025-06-10T02:00:00Z",
    "lastRunStatus": "SUCCESS"
  }
]
```

---

## miot calendar slot-managers get

`miot calendar slot-managers get <id>`

Get a single slot manager by ID.

**JSON output:** Same shape as a single slot manager from `slot-managers list`.

---

## miot calendar slot-managers create

Create a new slot manager.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--calendar <id>` | string | yes | Calendar ID |
| `--days-in-advance <n>` | integer | no | Days in advance to generate |
| `--batch-days <n>` | integer | no | Batch size in days |

**JSON output:** Created slot manager object.

---

## miot calendar slot-managers update

`miot calendar slot-managers update <id>`

Update a slot manager.

| Flag | Type | Description |
|------|------|-------------|
| `--days-in-advance <n>` | integer | Days in advance |
| `--batch-days <n>` | integer | Batch size in days |
| `--active` | boolean | Activate the manager |
| `--no-active` | boolean | Deactivate the manager |

**JSON output:** Updated slot manager object.

---

## miot calendar slot-managers deactivate

`miot calendar slot-managers deactivate <id>`

Deactivate a slot manager.

**JSON output:**

```json
{ "success": true }
```

---

## miot calendar slot-managers run

`miot calendar slot-managers run [id]`

Run slot managers to generate slots.

- Without `<id>`: run **all** active managers.
- With `<id>`: run a **specific** manager.

**JSON output (single):**

```json
{
  "id": "run_001",
  "managerId": "sm_001",
  "status": "SUCCESS",
  "slotsCreated": 42,
  "slotsSkipped": 3
}
```

**JSON output (all):** Array of run result objects.

---

## miot calendar slot-managers runs

`miot calendar slot-managers runs [managerId]`

List historical slot manager runs.

| Flag | Type | Description |
|------|------|-------------|
| `--limit <n>` | integer | Limit number of results |

- Without `[managerId]`: list runs for **all** managers.
- With `[managerId]`: list runs for a **specific** manager.

**JSON output:**

```json
[
  {
    "id": "run_001",
    "managerId": "sm_001",
    "status": "SUCCESS",
    "startedAt": "2025-06-10T02:00:00Z",
    "finishedAt": "2025-06-10T02:00:15Z",
    "slotsCreated": 42,
    "slotsSkipped": 3
  }
]
```

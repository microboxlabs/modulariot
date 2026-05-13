# Client Package Conventions

## Package: `@microboxlabs/miot-calendar-client`

Path: `packages/miot-calendar-client/`

### File layout

```
src/
├── types.ts           ← all interfaces, grouped by domain
├── client.ts          ← createMiotCalendarClient factory + Fetcher type
├── errors.ts          ← MiotCalendarApiError
├── index.ts           ← re-exports everything
└── resources/
    ├── bookings.ts
    ├── calendars.ts
    ├── groups.ts
    ├── slot-managers.ts
    └── slots.ts
```

### Fetcher signature (`client.ts`)

```typescript
export type Fetcher = <T, TBody = unknown>(
  method: string,
  path: string,
  options?: FetchOptions<TBody>,
) => Promise<T>
```

Every resource file imports `Fetcher` and uses it as:

```typescript
import type { Fetcher } from "../client.js";

export function createXxxApi(fetcher: Fetcher) {
  return {
    methodName(arg: string): Promise<ResponseType> {
      return fetcher("GET", `/api/v1/miot-calendar/xxx/${arg}`);
    },
    // ...
  };
}
```

### `types.ts` section order

```
// --- Enum ---
// --- Shared data types ---
// --- Bookings ---
// --- Calendar Groups ---
// --- Calendars ---
// --- Time Windows ---
// --- Slots ---
// --- Slot Managers ---
// --- Error ---
// --- Client config ---
```

Add new interfaces within the section that matches their domain. Preserve alphabetical order within a section when in doubt.

### Interface conventions

- Required fields: no `?`
- Optional fields (not in OpenAPI `required` array): `?`
- Date/time fields: `string` (ISO 8601, no special type)
- UUID fields: `string`
- Void responses (204): method returns `Promise<void>`

### Base paths per resource

| Resource file | Base path constant |
|---|---|
| `calendars.ts` | `/api/v1/miot-calendar/calendars` |
| `bookings.ts` | `/api/v1/miot-calendar/bookings` |
| `groups.ts` | `/api/v1/miot-calendar/groups` |
| `slots.ts` | `/api/v1/miot-calendar/slots` |
| `slot-managers.ts` | `/api/v1/miot-calendar/slot-managers` |

Each resource file defines a local `const BASE = "..."` at the top.

### Test utilities (`src/__tests__/test-utils.ts`)

```typescript
// Returns { fn, call } where:
// - fn: mock fetch function to pass to createMiotCalendarClient
// - call: { url, init } captured from the first fetch call
createMockFetch(responseBody, statusCode = 200)
```

**Test pattern for a new void method (204):**

```typescript
describe("purge", () => {
  it("sends DELETE to resource/:id/purge", async () => {
    const { fn, call } = createMockFetch(undefined, 204);
    const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

    await client.calendars.purge("cal-1");

    expect(call.init.method).toBe("DELETE");
    expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1/purge`);
  });

  it("returns undefined", async () => {
    const { fn } = createMockFetch(undefined, 204);
    const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

    const result = await client.calendars.purge("cal-1");

    expect(result).toBeUndefined();
  });
});
```

**Test pattern for a new method with a request body:**

```typescript
it("sends POST with body", async () => {
  const { fn, call } = createMockFetch(sampleResponse);
  const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

  await client.resource.create(requestBody);

  expect(call.init.method).toBe("POST");
  expect(call.url).toBe(`${BASE_URL}${BASE_PATH}`);
  expect(call.init.body).toBe(JSON.stringify(requestBody));
});
```

### Running tests

```bash
npm run test --workspace=packages/miot-calendar-client
```

### `index.ts` export pattern

Types are re-exported in a single bulk `export type { ... }` block. When adding new interfaces, append them to that block — do not create separate export statements.

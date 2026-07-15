# Calendar bookings → SWR (instant revisit)

## Goal

Revisiting an already-loaded calendar should paint **instantly** from cache
instead of blanking and refetching. Today the grid's booking chips load via a
plain `fetch` + `useState` in `PlanningSelectionProvider`; `useState` is
component-local, so a cross-calendar route change remounts the provider, resets
`plannedServices` to `[]`, and refetches from scratch. SWR's cache is
module-global and survives remounts → a repeat visit is a synchronous cache hit.

Branch `refactor/calendar-bookings-swr`, off `feat/calendar-search` (reuses
`mapBookingToPlannedService`, avoids a loadBookings conflict). Worktree so the
search-branch dev server stays undisturbed.

## The low-risk shape: adapter, not rewrite

Every booking mutation writes through exactly two setters — `setPlannedServices`
and `setBookingIds`. So DON'T rewrite the mutation sites (especially the
`confirmService` choke point handling create/move/reassign/assign with
optimistic-then-rollback). Instead:

- `useSWR(bookingsKey, fetcher, { keepPreviousData: true })` owns loading.
- `plannedServices = data?.planned ?? []`, `bookingIds = data?.ids ?? EMPTY_MAP`
  (derived, not state).
- Redefine `setPlannedServices` / `setBookingIds` as thin **adapters** that route
  `(prev) => next` updaters into `mutate((cache) => ({ ...cache, planned/ids }),
  { revalidate: false })`. SWR's function-updater reads current cache, so
  sequential mutate calls compose exactly like sequential setState.
- Delete the manual load `useEffect` + AbortController (SWR handles staleness:
  it won't apply a response for a non-current key).
- All six mutation sites and `rollbackPlannedService(setPlannedServices, …)` stay
  **byte-identical**.

This confines the change to the state backing; the delicate optimistic logic is
untouched.

## Mutation surface (must keep working — all via the two setters)

- `confirmService` (CTX) — the choke point: optimistic add (create/replan/move/
  reassign/assign), then persist, then set bookingId + bump version; rollback on
  throw via `rollbackPlannedService`. Reads `bookingIds.get(id)` for oldBookingId.
- `removeService` — filter out service + delete id + bump version (after awaits).
- `removeAssignment` — patch service tuple (no bookingIds change) + bump version.
- `updateServiceAssignment` — local patch, no persist, no version bump.
- `bookingVersion` — bumped on mutations; drives `onBookingChange → refreshLiveTasks`
  only (never re-reads bookings). KEEP as-is.

## Behavior deltas (intended)

- **Error no longer blanks.** Today a failed refetch sets `plannedServices=[]`.
  SWR keeps the last good data on error. Surface `error → bookingsLoadError` +
  `host.notify` via an effect (fire once per new error). Net: transient errors
  stop wiping the grid — an improvement, but a deliberate behavior change.
- **keepPreviousData**: on key change (date/calendar) the prior data stays on
  screen until the new load resolves — no blank during the transition.
- **No post-mutation re-read** (unchanged): optimistic state remains the state
  until the key changes. Not introducing revalidation-after-mutate (would fight
  the task-driven skip-persist paths).

## SWR key & fetcher

- Key: existing `bookingsKey = \`${calendarId}:${start}:${end}\`` (prop from
  wrapper), or `null` when `!calendarId` (SWR skips). Cache hit on revisit to the
  same calendar+window.
- Fetcher: stable `useCallback(() => loadBookingsRef.current(), [])` reading the
  latest host `loadBookings` via ref — so a host-identity change (permissions/
  i18n) does NOT refetch (SWR only fetches on key change), preserving the current
  ref-based optimization for free. Make `loadBookings` signal optional.

## Dependency

Add `swr` as a **peerDependency** of the package (mirroring `react`) + a
devDependency, so the package resolves the app's single SWR instance — a bundled
copy would have a separate module-global cache and defeat the remount-survival
goal. App already has `swr ^2`.

## Known non-goal / follow-up

- The window slides per-day (`?date ±30`), so stepping across dates within a
  calendar is a different key each time (first visit fetches, keepPreviousData
  smooths it; revisits hit cache). Quantizing the window to coarse buckets to
  raise the cache-hit rate is a separate optimization, not this change.

## Gate

Build package + app, check-types, full vitest (incl. task-driven-assign tests),
app `next build`, then **drive the browser**: plan a booking, reassign, assign,
remove — confirm each still works — then revisit a calendar and confirm it paints
instantly (no blank).

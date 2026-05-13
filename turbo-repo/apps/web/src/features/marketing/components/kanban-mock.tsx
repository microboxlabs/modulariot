"use client";

import { useEffect, useState } from "react";

/**
 * KanbanMock — animated 3-column control-tower kanban for the showcase section.
 * Trips rotate across columns on a 2.2s tick. One trip pulses with the
 * alert-pulse rose halo to demonstrate the symptom-aware kanban behavior.
 *
 * Source: design-ref/.../landing/showcase.jsx KanbanShowcase.
 */

type Col = { name: string; tone: string; bg: string; fg: string };

const COLS: Col[] = [
  { name: "Pending", tone: "#F59E0B", bg: "#FEF3C7", fg: "#D97706" },
  { name: "In progress", tone: "#1C64F2", bg: "#E1EFFE", fg: "#1A56DB" },
  { name: "Approved", tone: "#0E9F6E", bg: "#DEF7EC", fg: "#046C4E" },
];

type Trip = {
  code: string;
  driver: string;
  loc: string;
  weight: string;
  baseCol: number;
};

const TRIPS_BASE: Trip[] = [
  { code: "VJ-4821", driver: "O. Mendoza", loc: "Faena Norte", weight: "32t", baseCol: 0 },
  { code: "VJ-4815", driver: "L. Quiroga", loc: "Salar Sur", weight: "28t", baseCol: 1 },
  { code: "VJ-4807", driver: "M. Vargas", loc: "Faena Este", weight: "30t", baseCol: 2 },
  { code: "VJ-4798", driver: "C. Rojas", loc: "Puerto", weight: "31t", baseCol: 2 },
];

export function KanbanMock() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 2200);
    return () => clearInterval(id);
  }, []);

  // Trips rotate columns each tick (except the last which stays in Approved).
  const trips = TRIPS_BASE.map((t, i) => ({
    ...t,
    col: i === 3 ? 2 : (t.baseCol + tick) % 3,
    alert: i === 0 && tick % 5 === 2,
  }));

  return (
    <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface-1 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2.5 border-b border-hairline bg-surface-2 px-4 py-3 font-mono text-[11px] text-ink-3 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        <span
          className="size-2 rounded-full bg-action"
          style={{ animation: "live-pulse 2s ease-out infinite" }}
          aria-hidden
        />
        <span className="font-medium text-ink-1 dark:text-gray-50">
          Torre de control · Mintral
        </span>
        <span className="ml-auto">12 visibles · ETA 14:32</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 bg-surface-2 p-3.5 dark:bg-gray-950">
        {COLS.map((col, ci) => {
          const colTrips = trips.filter((t) => t.col === ci);
          return (
            <div key={col.name} className="min-h-[280px]">
              <div
                className="mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: col.bg, color: col.fg }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: col.tone }}
                  aria-hidden
                />
                {col.name}
                <span style={{ color: col.fg, opacity: 0.7 }}>{colTrips.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colTrips.map((trip) => (
                  <TripCard key={trip.code} trip={trip} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TripCard({
  trip,
}: {
  trip: Trip & { col: number; alert: boolean };
}) {
  return (
    <div
      className="rounded-lg border bg-surface-1 p-2.5 transition-all duration-300 dark:bg-gray-900"
      style={{
        borderColor: trip.alert ? "#FDA4AF" : "var(--color-hairline)",
        boxShadow: trip.alert ? "0 0 0 4px rgba(225,29,72,0.10)" : undefined,
        animation: trip.alert
          ? "alert-pulse 1.4s ease-in-out infinite alternate"
          : undefined,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-3">{trip.code}</span>
        {trip.alert ? (
          <span className="rounded-full bg-rose-100 px-1.5 py-px text-[9px] font-semibold tracking-[0.04em] text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            SÍNTOMA
          </span>
        ) : null}
      </div>
      <div className="mb-1 text-[12px] font-semibold text-ink-1 dark:text-gray-50">
        {trip.driver}
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span>{trip.loc}</span>
        <span className="rounded bg-surface-3 px-1.5 py-px font-mono text-[10px] dark:bg-gray-800">
          {trip.weight}
        </span>
      </div>
    </div>
  );
}

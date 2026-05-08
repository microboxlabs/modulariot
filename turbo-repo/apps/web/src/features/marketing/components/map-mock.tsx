"use client";

import { useEffect, useState } from "react";

/**
 * MapMock — animated satellite-view mock with truck pins. One truck pulses
 * with the rose alert-pulse to demonstrate symptom-aware live tracking.
 *
 * Source: design-ref/.../landing/showcase.jsx MapShowcase.
 */

export function MapMock() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1100);
    return () => clearInterval(id);
  }, []);

  const trucks = [
    { id: "T-01", x: 25 + (tick % 10), y: 30, sym: false },
    {
      id: "T-02",
      x: 60 + Math.sin(tick / 3) * 8,
      y: 50 + Math.cos(tick / 4) * 5,
      sym: tick % 8 < 4,
    },
    { id: "T-03", x: 40, y: 70 - (tick % 6), sym: false },
    { id: "T-04", x: 75, y: 25, sym: false },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-hairline bg-surface-1 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2.5 border-b border-hairline bg-surface-2 px-4 py-3 font-mono text-[11px] text-ink-3 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        <span className="font-medium text-ink-1 dark:text-gray-50">
          Mapa · satellite view
        </span>
        <span className="ml-auto">4 vehículos</span>
      </div>
      <div
        className="relative min-h-[240px] flex-1"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(63,131,248,0.08) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(14,159,110,0.06) 0%, transparent 50%),
            var(--color-surface-2)
          `,
        }}
      >
        {/* grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* geofence */}
        <div
          aria-hidden
          className="absolute rounded-xl opacity-50"
          style={{
            left: "15%",
            top: "15%",
            width: "55%",
            height: "55%",
            border: "1.5px dashed var(--color-blue-600)",
          }}
        />
        {/* route lines */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
        >
          <path
            d="M 80 80 Q 200 100 280 180"
            stroke="var(--color-blue-600)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
            opacity="0.4"
          />
          <path
            d="M 100 220 Q 180 180 240 140"
            stroke="var(--color-ink-4)"
            strokeWidth="1"
            strokeDasharray="2 4"
            fill="none"
            opacity="0.5"
          />
        </svg>
        {/* truck pins */}
        {trucks.map((t) => (
          <div
            key={t.id}
            className="absolute"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform: "translate(-50%, -50%)",
              transition: "all 1100ms linear",
            }}
          >
            <div
              className="grid size-[18px] place-items-center rounded-full text-[8px] font-semibold text-white"
              style={{
                background: t.sym ? "#E11D48" : "#1C64F2",
                boxShadow: t.sym
                  ? "0 0 0 6px rgba(225,29,72,0.15), 0 0 14px rgba(225,29,72,0.6)"
                  : "0 0 0 4px rgba(28,100,242,0.15)",
                border: "2px solid var(--color-surface-1)",
                animation: t.sym
                  ? "alert-pulse 1.2s ease-in-out infinite alternate"
                  : undefined,
              }}
            >
              {t.id.slice(-1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

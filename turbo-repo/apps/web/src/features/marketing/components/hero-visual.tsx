"use client";

import { useEffect, useState } from "react";

/**
 * HeroVisual — terminal-window pipeline-card showing live data flowing through
 * the four operational lanes: signals → behaviors → symptoms → treatments.
 *
 * SSR ships frame `tick=0` (deterministic). After hydration the interval steps
 * `tick` every 1.4s so the values look alive. Reduce-motion respect is handled
 * by the global gate in globals.css (animation/transition durations clamped to
 * 0.01ms) — the interval continues but the row-flash transition is instantaneous.
 */
export function HeroVisual() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const signals = [
    { k: "gps", label: "gps.lat", v: () => (23.6438 + Math.sin(tick / 5) * 0.0004).toFixed(4) },
    { k: "spd", label: "speed", v: () => `${(82 + (tick % 9)).toFixed(0)} km/h` },
    { k: "rpm", label: "rpm", v: () => `${2800 + ((tick * 17) % 80)}` },
    { k: "tmp", label: "temp.eng", v: () => `${(89 + (tick % 5)).toFixed(0)}°C` },
    { k: "acc", label: "accel", v: () => `${(-0.4 - Math.abs(Math.sin(tick / 3)) * 0.1).toFixed(2)}g` },
  ];
  const behaviors = ["braking.harsh × 3", "speed.over_limit", "lane.deviation"];
  const symptoms: { name: string; sev: number; color: string }[] = [
    { name: "Driver fatigue", sev: 2, color: "#F59E0B" },
    { name: "Geofence exit", sev: 3, color: "#E11D48" },
  ];
  const actions = [
    { who: "sms → supervisor", at: "14:32:08", ok: true },
    { who: "task → tower", at: "14:32:11", ok: true },
    { who: "trip.hold ack", at: "14:32:14", ok: tick % 3 !== 1 },
  ];

  const flashSignal = tick % signals.length;
  const flashSymptom = (Math.floor(tick / 4)) % symptoms.length;

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-hairline bg-surface-1 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
      {/* title bar */}
      <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-hairline-strong" />
          <span className="size-2.5 rounded-full bg-hairline-strong" />
          <span className="size-2.5 rounded-full bg-hairline-strong" />
        </div>
        <div className="font-mono text-[12px] text-ink-3">modulariot · live pipeline</div>
        <div className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-3">
          <span
            className="inline-block size-2 rounded-full bg-action"
            style={{ animation: "live-pulse 2s ease-out infinite" }}
            aria-hidden
          />
          live
        </div>
      </div>

      {/* 4 lanes */}
      <div className="grid grid-cols-4 gap-0">
        <Lane title="signals" tone="#3F83F8">
          {signals.map((s, i) => (
            <Row key={s.k} flash={i === flashSignal} dot="#3F83F8">
              <span className="text-ink-3">{s.label}</span>
              <span className="ml-auto text-ink-1">{s.v()}</span>
            </Row>
          ))}
        </Lane>
        <Lane title="behaviors" tone="#76A9FA">
          {behaviors.map((b, i) => (
            <Row
              key={b}
              flash={i === Math.floor(tick / 2) % behaviors.length}
              dot="#76A9FA"
            >
              <span>{b}</span>
            </Row>
          ))}
          <Row dot="#76A9FA" subtle>
            <span className="text-ink-3">geofence.near_exit</span>
          </Row>
        </Lane>
        <Lane title="symptoms" tone="#F59E0B">
          {symptoms.map((s, i) => (
            <SymptomRow key={s.name} flash={i === flashSymptom} sym={s} />
          ))}
          <Row dot="#F59E0B" subtle>
            <span className="text-ink-3">Engine overheat</span>
            <span className="ml-auto text-[10px] text-ink-3">watch</span>
          </Row>
        </Lane>
        <Lane title="treatments" tone="#0E9F6E" last>
          {actions.map((a, i) => (
            <Row
              key={a.who}
              flash={i === Math.floor(tick / 3) % actions.length}
              dot={a.ok ? "#0E9F6E" : "#9CA3AF"}
            >
              <span>{a.who}</span>
              <span className="ml-auto text-[10px] text-ink-3">{a.at}</span>
            </Row>
          ))}
        </Lane>
      </div>

      {/* bottom strip */}
      <div className="flex items-center justify-between border-t border-hairline bg-surface-2 px-4 py-2.5 font-mono text-[11px] text-ink-3 dark:border-gray-800 dark:bg-gray-950">
        <span>incident #4821 · open · sev 3</span>
        <span className="inline-flex gap-3">
          <span>p50 47ms</span>
          <span>p99 112ms</span>
        </span>
      </div>
    </div>
  );
}

function Lane({
  title,
  tone,
  children,
  last,
}: {
  title: string;
  tone: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[230px] flex-col gap-1.5 px-3 py-3.5 ${
        last ? "" : "border-r border-hairline dark:border-gray-800"
      }`}
    >
      <div
        className="mb-1.5 inline-flex items-center gap-1.5 pl-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: tone }}
      >
        <span
          className="inline-block size-[5px] rounded-full"
          style={{ background: tone }}
        />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  children,
  flash,
  dot,
  subtle,
}: {
  children: React.ReactNode;
  flash?: boolean;
  dot?: string;
  subtle?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border px-1.5 py-1 font-mono text-[10.5px] text-ink-2 transition-colors duration-300"
      style={{
        background: flash
          ? "color-mix(in srgb, var(--color-blue-600) 10%, transparent)"
          : subtle
            ? "transparent"
            : "var(--color-surface-2)",
        borderColor: flash ? "var(--color-blue-600)" : "var(--color-hairline)",
        opacity: subtle ? 0.6 : 1,
      }}
    >
      {dot ? (
        <span
          className="inline-block size-[5px] shrink-0 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {children}
    </div>
  );
}

function SymptomRow({
  sym,
  flash,
}: {
  sym: { name: string; sev: number; color: string };
  flash: boolean;
}) {
  return (
    <div
      className="rounded-md border px-2.5 py-2 transition-all duration-300"
      style={{
        background: flash ? "rgba(245, 158, 11, 0.10)" : "var(--color-surface-2)",
        borderColor: flash ? "#F59E0B" : "var(--color-hairline)",
      }}
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <span
          className="inline-block size-[5px] rounded-full"
          style={{ background: sym.color }}
        />
        <span className="text-[11px] font-medium text-ink-1">{sym.name}</span>
      </div>
      <div className="flex gap-1.5 font-mono text-[9.5px] text-ink-3">
        <span>open</span>
        <span>·</span>
        <span>sev {sym.sev}</span>
      </div>
    </div>
  );
}

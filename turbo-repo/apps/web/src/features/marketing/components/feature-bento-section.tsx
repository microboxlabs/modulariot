/**
 * Feature bento — 6 cards on a 6-col grid (b-3 b-3 b-2 b-2 b-2 b-6 layout).
 * Each card has a unique mini-visual that "shows the product" instead of just
 * saying it. Source: design-ref/.../landing/{app.jsx Bento, landing.css .bento*}.
 */

import type { ReactNode } from "react";

type Card = {
  title: string;
  body: string;
  tag: string;
  span: "b-3" | "b-2" | "b-6";
  visual: ReactNode;
};

const SPAN_CLASS: Record<Card["span"], string> = {
  "b-3": "lg:col-span-3",
  "b-2": "lg:col-span-2",
  "b-6": "lg:col-span-6",
};

// ---- Mini-visuals ----------------------------------------------------------

function SymptomVisual() {
  const symptoms = [
    { name: "Driver fatigue", sev: 2, color: "#F59E0B", state: "open" },
    { name: "Geofence exit", sev: 3, color: "#E11D48", state: "open" },
    { name: "Engine overheat", sev: 1, color: "#3F83F8", state: "watch" },
  ];
  return (
    <div className="mt-2 flex flex-col gap-2">
      {symptoms.map((s) => (
        <div
          key={s.name}
          className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: s.color }}
            aria-hidden
          />
          <span className="flex-1 text-[13px] font-medium text-ink-1 dark:text-gray-50">
            {s.name}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            {s.state} · sev {s.sev}
          </span>
        </div>
      ))}
    </div>
  );
}

function IngestVisual() {
  return (
    <div className="mt-2 rounded-lg border border-hairline bg-surface-2 p-3.5 font-mono text-[11.5px] leading-[1.7] text-ink-2 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
      <div>
        <span className="text-ink-4">POST</span> /v1/signals
      </div>
      <div>
        <span className="text-blue-600 dark:text-blue-400">
          {`{ device: "T-04", lat: 23.6438,`}
        </span>
      </div>
      <div className="pl-4">
        <span className="text-blue-600 dark:text-blue-400">
          {`speed: 87, ts: 1730932... }`}
        </span>
      </div>
      <div className="mt-2 text-ink-3">→ behavior.detected · 47ms</div>
    </div>
  );
}

function OrchestVisual() {
  const rows = ["sms → supervisor", "task → tower", "trip.hold ack"];
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {rows.map((x) => (
        <div
          key={x}
          className="flex justify-between rounded-md border border-hairline bg-surface-2 px-2.5 py-2 font-mono text-[11px] text-ink-2 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
        >
          <span>{x}</span>
          <span className="text-action">ok</span>
        </div>
      ))}
    </div>
  );
}

function DashVisual() {
  const tiles = [1, 2, 3, 4];
  return (
    <div className="mt-2 grid h-[130px] grid-cols-2 gap-1.5">
      {tiles.map((n) => (
        <div
          key={n}
          className="flex flex-col justify-between rounded-md border border-hairline bg-surface-2 p-2 dark:border-gray-800 dark:bg-gray-950"
        >
          <div className="font-mono text-[9.5px] text-ink-3">VJ-48{20 - n}</div>
          <div className="font-semibold tabular-nums text-[18px] text-ink-1 dark:text-gray-50">
            {94 - n * 7}%
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceVisual() {
  const lines = [
    "14:32:08 sms.sent",
    "14:32:11 task.created",
    "14:32:14 ack.O.Mendoza",
    "14:32:21 hold.released",
  ];
  return (
    <div className="mt-2 font-mono text-[11px] text-ink-2 dark:text-gray-300">
      {lines.map((l) => (
        <div
          key={l}
          className="border-b border-dashed border-hairline py-1 dark:border-gray-800"
        >
          <span className="text-ink-4">›</span> {l}
        </div>
      ))}
    </div>
  );
}

function OssVisual() {
  return (
    <div className="mt-2 flex items-center justify-between gap-4">
      <div className="flex flex-1 flex-col gap-2">
        <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-2 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          $ helm install modulariot modulariot/platform
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2 font-mono text-[12px] text-action dark:border-gray-800 dark:bg-gray-950">
          ✓ deployed in 3m 14s · your cluster
        </div>
      </div>
      <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-ink-1 text-surface-1 dark:bg-gray-50 dark:text-gray-900">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-7"
          aria-hidden
        >
          <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.17 0 0 1-.32 3.3 1.23a11.45 11.45 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z" />
        </svg>
      </div>
    </div>
  );
}

// ---- Cards data ------------------------------------------------------------

const CARDS: Card[] = [
  {
    title: "Symptom Intelligence",
    body: "Stateful operational concepts with severity, ownership, evolution and treatment — the layer above alerts.",
    tag: "Core",
    span: "b-3",
    visual: <SymptomVisual />,
  },
  {
    title: "Real-time ingestion",
    body: "MQTT, REST, gRPC, batch. Provider-agnostic. Sub-second to first behavior.",
    tag: "I/O",
    span: "b-3",
    visual: <IngestVisual />,
  },
  {
    title: "Orchestration",
    body: "Trigger workflows from symptoms. n8n, BPMN, or your own engine — pluggable.",
    tag: "Workflow",
    span: "b-2",
    visual: <OrchestVisual />,
  },
  {
    title: "Live dashboards",
    body: "Map, kanban, timeline, control-tower. Built for operators, not analysts.",
    tag: "UI",
    span: "b-2",
    visual: <DashVisual />,
  },
  {
    title: "Evidence vault",
    body: "Append-only operational record. Audit, compliance, replay, hand-off.",
    tag: "Storage",
    span: "b-2",
    visual: <EvidenceVisual />,
  },
  {
    title: "Open-source · BYO cloud",
    body: "Apache-2.0. Deploy to AWS, GCP, Azure or on-prem. You own the data.",
    tag: "OSS",
    span: "b-6",
    visual: <OssVisual />,
  },
];

export function FeatureBentoSection() {
  return (
    <section
      id="features"
      aria-labelledby="bento-heading"
      className="bg-surface-2 py-24 lg:py-[96px] dark:bg-gray-950"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="max-w-[720px]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
            <span
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
            Primitives
          </span>
          <h2
            id="bento-heading"
            className="mt-[18px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
            style={{ fontSize: "clamp(30px, 3.8vw, 46px)" }}
          >
            Replaceable components around a consistent operational model
          </h2>
          <p className="mt-[14px] max-w-[56ch] text-balance text-[17px] leading-[1.55] text-ink-2 dark:text-gray-300">
            The architecture stays stable even as the stack evolves. Bring your
            own ingest, your own storage, your own orchestrator.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {CARDS.map((card) => (
            <article
              key={card.title}
              className={`${SPAN_CLASS[card.span]} group relative flex min-h-[240px] flex-col overflow-hidden rounded-[14px] border border-hairline bg-surface-1 p-6 transition-colors hover:border-hairline-strong dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink-1 dark:text-gray-50">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 max-w-[38ch] text-[13.5px] leading-[1.5] text-ink-3 dark:text-gray-400">
                    {card.body}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-hairline bg-surface-2 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                  {card.tag}
                </span>
              </div>
              <div className="relative mt-[18px] flex-1">{card.visual}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

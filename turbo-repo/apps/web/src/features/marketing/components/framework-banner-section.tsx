/**
 * Framework banner — 8-up icon grid showing protocols, stream, storage,
 * workflow and cloud options. Replaces run-1's CompatibilityBannerSection
 * with the design's hairline-divided lattice pattern.
 *
 * The grid uses the design's clever trick: `gap: 1px` on a hairline-colored
 * outer surface, with each cell on `bg-surface-1`. The 1px gaps render as
 * thin dividers because the cells cover everything except the gap.
 *
 * Source: design-ref/.../landing/{app.jsx Framework, landing.css .framework*}.
 */

import type { ReactNode } from "react";

type ItemKind = "protocol" | "stream" | "store" | "workflow" | "cloud";
type Item = { label: string; kind: ItemKind };

const ITEMS: Item[] = [
  { label: "MQTT", kind: "protocol" },
  { label: "REST", kind: "protocol" },
  { label: "Pulsar", kind: "stream" },
  { label: "Kafka", kind: "stream" },
  { label: "Postgres", kind: "store" },
  { label: "n8n", kind: "workflow" },
  { label: "AWS · GCP · Azure", kind: "cloud" },
  { label: "On-prem · Air-gap", kind: "cloud" },
];

const ICONS: Record<ItemKind, ReactNode> = {
  protocol: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  stream: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M3 6c4 0 4 4 8 4s4-4 8-4M3 14c4 0 4 4 8 4s4-4 8-4" />
    </svg>
  ),
  store: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  ),
  workflow: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.5 7.5l3 8M16.5 7.5l-3 8" />
    </svg>
  ),
  cloud: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M17 19a4 4 0 100-8 5 5 0 00-9.6 1.4A3.5 3.5 0 008 19h9z" />
    </svg>
  ),
};

export function FrameworkBannerSection() {
  return (
    <section
      aria-labelledby="framework-heading"
      className="border-y border-hairline bg-surface-1 py-14 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1280px] px-6 text-center">
        <h3
          id="framework-heading"
          className="m-0 text-[18px] font-semibold tracking-[-0.01em] text-ink-1 dark:text-gray-50"
        >
          Use Modular IoT with any hardware and any cloud
        </h3>
        <p className="mb-0 mt-2 text-[14px] text-ink-3 dark:text-gray-400">
          Composable by design. Swap components without rewriting your
          operational model.
        </p>
        <div
          className="mt-8 grid grid-cols-4 overflow-hidden rounded-[10px] border border-hairline bg-hairline lg:grid-cols-8 dark:border-gray-800 dark:bg-gray-800"
          style={{ gap: 1 }}
        >
          {ITEMS.map((it) => (
            <div
              key={it.label}
              className="flex flex-col items-center gap-2 bg-surface-1 px-3 py-[22px] text-center text-[11.5px] text-ink-3 dark:bg-gray-900 dark:text-gray-400"
            >
              <span className="text-ink-2 dark:text-gray-300">
                {ICONS[it.kind]}
              </span>
              <span className="font-medium">{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

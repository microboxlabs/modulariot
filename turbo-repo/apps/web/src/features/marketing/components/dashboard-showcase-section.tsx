/**
 * Showcase section — Kanban + Map mocks side by side, plus a checked-bullet
 * list of operator-experience claims. Replaces run-1's fake-stats dashboard
 * showcase. Source: design-ref/.../landing/{app.jsx Showcase, landing.css
 * .showcase / .showcase-list / .check}.
 */

import { KanbanMock } from "./kanban-mock";
import { MapMock } from "./map-mock";

const BULLETS = [
  {
    title: "Status-first density",
    body: "Pendiente, En curso, Aprobada, Rechazada — sentence-case, never ambiguous.",
  },
  {
    title: "Symptom-aware kanban",
    body: "Cards pulse rose when a symptom escalates. The board is the truth.",
  },
  {
    title: "Map · Timeline · Evidence",
    body: "Three views, one model. Every action leaves a trace.",
  },
  {
    title: "Bilingual operator copy",
    body: "Spanish-first, English-mirrored. Domain vocabulary stays in source language.",
  },
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function DashboardShowcaseSection() {
  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      className="py-24 lg:py-[96px]"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="max-w-[720px]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
            <span
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
            Operator experience
          </span>
          <h2
            id="showcase-heading"
            className="mt-[18px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
            style={{ fontSize: "clamp(30px, 3.8vw, 46px)" }}
          >
            Built for the people who run operations
          </h2>
          <p className="mt-[14px] max-w-[56ch] text-balance text-[17px] leading-[1.55] text-ink-2 dark:text-gray-300">
            Map, kanban, symptom timeline. Designed for radio-dispatch density,
            not analyst dashboards.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <KanbanMock />
          <div className="flex flex-col gap-4">
            <MapMock />
            <ul className="flex flex-col gap-3.5">
              {BULLETS.map((b) => (
                <li
                  key={b.title}
                  className="flex items-start gap-3.5 py-1.5"
                >
                  <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <CheckIcon />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-ink-1 dark:text-gray-50">
                      {b.title}
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-3 dark:text-gray-400">
                      {b.body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

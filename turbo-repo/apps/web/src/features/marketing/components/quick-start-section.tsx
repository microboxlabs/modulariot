/**
 * Quick start — 3-up card grid that absorbs the developer-surface role from
 * run-1's QuickStart (terminal blocks) AND ExamplesGallery (6 link cards).
 * Source: design-ref/.../landing/{app.jsx QuickStart, landing.css .qs-*}.
 *
 * Three primary developer paths from i18n.jsx t.quickstart.cards:
 *   1. Helm chart · Kubernetes
 *   2. n8n workflow templates
 *   3. Symptom API examples
 */

import Link from "next/link";
import type { ReactNode } from "react";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

type Card = {
  icon: ReactNode;
  title: string;
  body: string;
  meta: string;
  href: string;
};

function ArrowRight({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const HelmIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden
  >
    <path d="M12 3l8 4-8 4-8-4 8-4z" />
    <path d="M4 11l8 4 8-4" />
    <path d="M4 15l8 4 8-4" />
  </svg>
);

const N8nIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden
  >
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M7.5 7.5l3 8M16.5 7.5l-3 8" />
  </svg>
);

const ApiIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden
  >
    <path d="M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 4l-3 16" />
  </svg>
);

const CARDS: Card[] = [
  {
    icon: HelmIcon,
    title: "Helm chart · Kubernetes",
    body: "Deploy the full platform — broker, processor, dashboards — to any K8s cluster.",
    meta: "modulariot/helm · v0.9.2",
    href: REPO_URL,
  },
  {
    icon: N8nIcon,
    title: "n8n workflow templates",
    body: "12 ready-made flows: dispatch escalation, ETA recalculation, fatigue protocol.",
    meta: "templates/n8n · 12 flows",
    href: REPO_URL,
  },
  {
    icon: ApiIcon,
    title: "Symptom API examples",
    body: "REST + WebSocket clients in TypeScript, Python, Go. Define and observe symptoms.",
    meta: "examples/symptom-api · 3 langs",
    href: REPO_URL,
  },
];

export function QuickStartSection() {
  return (
    <section
      id="quickstart"
      aria-labelledby="quickstart-heading"
      className="bg-surface-2 py-24 lg:py-[96px] dark:bg-gray-950"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="max-w-[720px]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
            <span
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
            Quick start
          </span>
          <h2
            id="quickstart-heading"
            className="mt-[18px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
            style={{ fontSize: "clamp(30px, 3.8vw, 46px)" }}
          >
            Start monitoring in minutes
          </h2>
          <p className="mt-[14px] max-w-[56ch] text-balance text-[17px] leading-[1.55] text-ink-2 dark:text-gray-300">
            Templates and reference deployments to skip the integration grind.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-xl border border-hairline bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-hairline-strong dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              <span className="mb-3.5 grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                {card.icon}
              </span>
              <h3 className="text-[14.5px] font-semibold tracking-[-0.005em] text-ink-1 dark:text-gray-50">
                {card.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-[1.55] text-ink-3 dark:text-gray-400">
                {card.body}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 font-mono text-[11.5px] text-ink-3 dark:border-gray-800 dark:text-gray-400">
                <span>{card.meta}</span>
                <ArrowRight />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

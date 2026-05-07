import Image from "next/image";
import {
  HiOutlineArrowDownTray,
  HiOutlineBolt,
  HiOutlineCpuChip,
  HiOutlineCog6Tooth,
  HiOutlineEye,
} from "react-icons/hi2";
import type { ReactNode } from "react";

type Stage = {
  number: string;
  title: string;
  body: string;
  icon: ReactNode;
  accent: "blue" | "orange" | "yellow" | "gray";
};

const ACCENT: Record<Stage["accent"], string> = {
  blue: "text-blue-500 ring-blue-200 dark:ring-blue-900/40",
  orange: "text-orange-500 ring-orange-200 dark:ring-orange-900/40",
  yellow: "text-yellow-500 ring-yellow-200 dark:ring-yellow-900/40",
  gray: "text-gray-500 ring-gray-200 dark:ring-gray-800",
};

const STAGES: Stage[] = [
  {
    number: "01",
    title: "Capture",
    body:
      "Ingest signals from any device, fleet, or sensor — at the edge or in the cloud.",
    icon: <HiOutlineArrowDownTray aria-hidden className="size-5" />,
    accent: "blue",
  },
  {
    number: "02",
    title: "Stream",
    body:
      "Route real-time data through a high-throughput pipeline with replayability and back-pressure.",
    icon: <HiOutlineBolt aria-hidden className="size-5" />,
    accent: "blue",
  },
  {
    number: "03",
    title: "Symptom Intelligence",
    body:
      "Detect behaviors, elevate them to symptoms with state and severity, and keep them alive until they resolve.",
    icon: <HiOutlineCpuChip aria-hidden className="size-5" />,
    accent: "orange",
  },
  {
    number: "04",
    title: "Orchestrate",
    body:
      "Trigger treatments, route to teams, and connect to the tools your operations already run on.",
    icon: <HiOutlineCog6Tooth aria-hidden className="size-5" />,
    accent: "yellow",
  },
  {
    number: "05",
    title: "Visualize & audit",
    body:
      "Live dashboards on top — queryable evidence trail underneath. Operators see the now; auditors see the why.",
    icon: <HiOutlineEye aria-hidden className="size-5" />,
    accent: "gray",
  },
];

export function ArchitectureSection() {
  return (
    <section
      id="architecture"
      aria-labelledby="architecture-heading"
      className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Architecture
          </p>
          <h2
            id="architecture-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Five stages.{" "}
            <span className="text-blue-500">Each one swappable.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Modular IoT keeps a consistent operational model — capture, stream,
            symptom intelligence, orchestrate, visualize — and lets each
            building block evolve. Drop in a different ingestion path, plug in
            a new orchestrator, point at your own data warehouse. The model
            stays the same.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Image
                src="/brand/architecture.svg"
                alt="Modular IoT architecture flow: capture → stream → symptom intelligence → orchestrate → visualize"
                width={800}
                height={400}
                className="h-auto w-full"
              />
              {/* Subtle data-flow sweep — gated by prefers-reduced-motion at the
                  global level (see globals.css). */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-16 animate-[architecture-flow_6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent dark:via-blue-400/15"
              />
            </div>
          </div>

          <ol className="flex flex-col gap-3 lg:col-span-5">
            {STAGES.map((stage) => (
              <li
                key={stage.number}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <span
                  className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 dark:bg-gray-950 ${ACCENT[stage.accent]}`}
                >
                  {stage.icon}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium tabular-nums text-gray-400">
                      {stage.number}
                    </span>
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stage.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Each block is a contract, not a vendor. Specific technologies evolve
          with the product.
        </p>
      </div>

      <style>{`
        @keyframes architecture-flow {
          0% { transform: translateX(-10%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(700%); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

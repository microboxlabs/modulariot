import { HiOutlineRocketLaunch, HiOutlineSignal } from "react-icons/hi2";
import type { ReactNode } from "react";

type CodeLine =
  | { kind: "comment"; text: string }
  | { kind: "command"; text: string }
  | { kind: "blank" };

type Step = {
  number: string;
  title: string;
  blurb: string;
  icon: ReactNode;
  lines: CodeLine[];
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Clone and run",
    blurb: "From repo to live pipeline in two commands.",
    icon: <HiOutlineRocketLaunch aria-hidden className="size-5" />,
    lines: [
      { kind: "comment", text: "# Clone the repo" },
      {
        kind: "command",
        text: "git clone https://github.com/microboxlabs/modulariot",
      },
      { kind: "blank" },
      { kind: "comment", text: "# Boot the full stack locally" },
      { kind: "command", text: "cd modulariot && docker compose up" },
    ],
  },
  {
    number: "02",
    title: "Send your first signal",
    blurb: "Ingest a telemetry sample. Watch it become a symptom.",
    icon: <HiOutlineSignal aria-hidden className="size-5" />,
    lines: [
      { kind: "comment", text: "# Post a single signal" },
      { kind: "command", text: "curl -X POST localhost:8080/v1/signals \\" },
      { kind: "command", text: "  -H 'Content-Type: application/json' \\" },
      {
        kind: "command",
        text:
          "  -d '{\"device\":\"truck-47\",\"speed\":118,\"geofence\":\"zone-a\"}'",
      },
    ],
  },
];

function CodeCard({ step }: { step: Step }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4 px-5 pt-5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900/40">
          {step.icon}
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium tabular-nums text-gray-400">
              {step.number}
            </span>
            <h3 className="text-base font-semibold">{step.title}</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {step.blurb}
          </p>
        </div>
      </div>

      <pre
        aria-label={`${step.title} command`}
        className="m-1 overflow-x-auto rounded-xl bg-gray-950 p-5 text-[13px] leading-6 text-gray-100"
      >
        <code className="font-mono">
          {step.lines.map((line, i) => {
            if (line.kind === "blank")
              return (
                <span key={i} aria-hidden className="block">
                  {" "}
                </span>
              );
            if (line.kind === "comment")
              return (
                <span key={i} className="block text-blue-300/70">
                  {line.text}
                </span>
              );
            return (
              <span key={i} className="block">
                <span className="select-none text-gray-500">$ </span>
                {line.text}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

export function QuickStartSection() {
  return (
    <section
      id="quickstart"
      aria-labelledby="quickstart-heading"
      className="bg-white dark:bg-gray-900"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Quick start
          </p>
          <h2
            id="quickstart-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Two commands.{" "}
            <span className="text-blue-500">First symptom in five minutes.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            No SaaS sign-up. No license keys. Clone, boot the stack on your
            machine, post a signal, watch it light up the dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {STEPS.map((step) => (
            <CodeCard key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}

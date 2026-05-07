import {
  HiOutlineChartBar,
  HiOutlineEye,
  HiOutlineExclamationCircle,
  HiOutlineCog,
  HiOutlineShieldCheck,
} from "react-icons/hi";
import { HiArrowLongRight } from "react-icons/hi2";
import type { ReactNode } from "react";

type Step = {
  name: string;
  blurb: string;
  icon: ReactNode;
  accent:
    | "text-blue-500"
    | "text-orange-500"
    | "text-gray-500"
    | "text-yellow-500";
};

const STEPS: Step[] = [
  {
    name: "Signals",
    blurb:
      "Raw telemetry captured from devices, vehicles, and sensors as it happens.",
    icon: <HiOutlineChartBar aria-hidden className="size-6" />,
    accent: "text-blue-500",
  },
  {
    name: "Behaviors",
    blurb:
      "Patterns identified across streams: deviations, sequences, threshold crossings.",
    icon: <HiOutlineEye aria-hidden className="size-6" />,
    accent: "text-blue-500",
  },
  {
    name: "Symptoms",
    blurb:
      "Behaviors elevated to operational state with severity, ownership, and lifecycle.",
    icon: <HiOutlineExclamationCircle aria-hidden className="size-6" />,
    accent: "text-orange-500",
  },
  {
    name: "Treatments",
    blurb:
      "Coordinated workflows that respond, escalate, and resolve — across teams and tools.",
    icon: <HiOutlineCog aria-hidden className="size-6" />,
    accent: "text-orange-500",
  },
  {
    name: "Evidence",
    blurb:
      "Every signal, symptom, and treatment leaves an auditable trace operators can review.",
    icon: <HiOutlineShieldCheck aria-hidden className="size-6" />,
    accent: "text-gray-500",
  },
];

export function TelemetrySymptomsSection() {
  return (
    <section
      id="symptoms"
      aria-labelledby="symptoms-heading"
      className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
            Open-source symptom intelligence
          </p>
          <h2
            id="symptoms-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            A symptom is{" "}
            <span className="text-orange-500">not just an alert.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Modular IoT moves operations beyond noisy notifications. Signals
            become behaviors. Behaviors become symptoms. Symptoms get treated —
            and every step leaves evidence.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {STEPS.map((step, index) => (
            <li key={step.name} className="relative flex">
              <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <span className={step.accent}>{step.icon}</span>
                  <span className="text-xs font-medium tabular-nums text-gray-400">
                    0{index + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{step.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.blurb}
                  </p>
                </div>
              </div>

              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-gray-300 lg:block dark:text-gray-700"
                >
                  <HiArrowLongRight className="size-6" />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

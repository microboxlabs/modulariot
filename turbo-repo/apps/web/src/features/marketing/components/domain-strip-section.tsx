import {
  HiOutlineTruck,
  HiOutlineBuildingOffice2,
  HiOutlineSignal,
} from "react-icons/hi2";
import type { ReactNode } from "react";

type Domain = {
  name: string;
  example: string;
  icon: ReactNode;
};

const DOMAINS: Domain[] = [
  {
    name: "Logistics",
    example:
      "Cargo runs, route deviations, signal-loss windows, evidence on every stop.",
    icon: <HiOutlineTruck aria-hidden className="size-6" />,
  },
  {
    name: "Fleet operations",
    example:
      "Driver fatigue, geofence breaches, real-time dispatch — control-tower view.",
    icon: <HiOutlineSignal aria-hidden className="size-6" />,
  },
  {
    name: "Industrial telemetry",
    example:
      "Plant uptime, threshold violations, root-cause symptoms across asset fleets.",
    icon: <HiOutlineBuildingOffice2 aria-hidden className="size-6" />,
  },
];

export function DomainStripSection() {
  return (
    <section
      id="domains"
      aria-labelledby="domains-heading"
      className="bg-white dark:bg-gray-900"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Built from real operational pressure
          </p>
          <h2
            id="domains-heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            For logistics, fleet operations, and industrial telemetry.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DOMAINS.map((domain) => (
            <li
              key={domain.name}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950"
            >
              <span className="text-blue-500">{domain.icon}</span>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">{domain.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {domain.example}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

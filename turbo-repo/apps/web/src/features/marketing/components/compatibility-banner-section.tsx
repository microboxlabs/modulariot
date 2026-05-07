import {
  HiOutlineCpuChip,
  HiOutlineGlobeAlt,
  HiOutlineCloud,
  HiOutlineServerStack,
  HiOutlineCommandLine,
  HiOutlineWifi,
  HiOutlineCodeBracketSquare,
} from "react-icons/hi2";
import { FaGithub } from "react-icons/fa";
import type { ReactNode } from "react";

type Pill = { label: string; icon: ReactNode };

const SOURCES: Pill[] = [
  { label: "GPS / GNSS", icon: <HiOutlineGlobeAlt aria-hidden className="size-4" /> },
  { label: "MQTT", icon: <HiOutlineWifi aria-hidden className="size-4" /> },
  { label: "LoRaWAN", icon: <HiOutlineWifi aria-hidden className="size-4" /> },
  { label: "Webhooks", icon: <HiOutlineCodeBracketSquare aria-hidden className="size-4" /> },
  { label: "Custom SDK", icon: <HiOutlineCpuChip aria-hidden className="size-4" /> },
];

const DEPLOYMENTS: Pill[] = [
  { label: "docker compose", icon: <HiOutlineCommandLine aria-hidden className="size-4" /> },
  { label: "Kubernetes / Helm", icon: <HiOutlineServerStack aria-hidden className="size-4" /> },
  { label: "Bare metal", icon: <HiOutlineServerStack aria-hidden className="size-4" /> },
  { label: "Any cloud", icon: <HiOutlineCloud aria-hidden className="size-4" /> },
  { label: "Air-gapped", icon: <HiOutlineServerStack aria-hidden className="size-4" /> },
];

function PillRow({ pills }: { pills: Pill[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <li
          key={p.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        >
          <span className="text-blue-500">{p.icon}</span>
          {p.label}
        </li>
      ))}
    </ul>
  );
}

export function CompatibilityBannerSection() {
  return (
    <section
      id="compatibility"
      aria-labelledby="compatibility-heading"
      className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Open-source and composable
          </p>
          <h2
            id="compatibility-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Plug into your stack.{" "}
            <span className="text-blue-500">Stay in your cloud.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Modular IoT speaks the protocols your devices already speak, and
            runs where your operations already run. Self-host on your hardware,
            your cloud, or your private network. Your data never leaves.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Capture from any source
            </h3>
            <PillRow pills={SOURCES} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Custom protocol? Add an ingester in a few hundred lines. Each
              capture path is a small, replaceable component.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Deploy where you run
            </h3>
            <PillRow pills={DEPLOYMENTS} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              MIT-licensed. No vendor lock-in. Bring your own cloud, your own
              database, your own compliance boundary.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href="https://github.com/microboxlabs/modulariot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <FaGithub aria-hidden className="size-4" />
            Read the source on GitHub
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

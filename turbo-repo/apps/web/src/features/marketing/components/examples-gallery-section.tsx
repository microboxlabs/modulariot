import {
  HiOutlineCommandLine,
  HiOutlineRocketLaunch,
  HiOutlineCubeTransparent,
  HiOutlineBolt,
  HiOutlineSquares2X2,
  HiOutlineDocumentText,
} from "react-icons/hi2";
import { FaGithub } from "react-icons/fa";
import type { ReactNode } from "react";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

type Example = {
  title: string;
  blurb: string;
  href: string;
  icon: ReactNode;
};

const EXAMPLES: Example[] = [
  {
    title: "docker compose quick start",
    blurb:
      "Spin up the full pipeline locally with one file. From clone to first symptom in < 5 minutes.",
    href: REPO_URL,
    icon: <HiOutlineRocketLaunch aria-hidden className="size-5" />,
  },
  {
    title: "Helm chart",
    blurb:
      "Production-grade Kubernetes deployment. Configurable per environment.",
    href: REPO_URL,
    icon: <HiOutlineCubeTransparent aria-hidden className="size-5" />,
  },
  {
    title: "Custom ingester template",
    blurb:
      "Add a new capture protocol in a few hundred lines. The pipeline does the rest.",
    href: REPO_URL,
    icon: <HiOutlineBolt aria-hidden className="size-5" />,
  },
  {
    title: "Workflow examples",
    blurb:
      "Reference orchestrations: incident routing, escalation paths, multi-team handoffs.",
    href: REPO_URL,
    icon: <HiOutlineSquares2X2 aria-hidden className="size-5" />,
  },
  {
    title: "REST + WebSocket API",
    blurb:
      "Curl, JavaScript, and Python snippets covering ingestion, queries, and orchestration.",
    href: REPO_URL,
    icon: <HiOutlineCommandLine aria-hidden className="size-5" />,
  },
  {
    title: "Symptom rule pack",
    blurb:
      "Starter rules for fleet, logistics, and industrial telemetry. Fork and tune.",
    href: REPO_URL,
    icon: <HiOutlineDocumentText aria-hidden className="size-5" />,
  },
];

export function ExamplesGallerySection() {
  return (
    <section
      id="examples"
      aria-labelledby="examples-heading"
      className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Build with Modular IoT
          </p>
          <h2
            id="examples-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Templates, snippets,{" "}
            <span className="text-blue-500">and full reference apps.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Every example is open-source. Fork, deploy, modify. The repo grows
            with the community.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <li key={ex.title}>
              <a
                href={ex.href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
              >
                <span className="text-blue-500">{ex.icon}</span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{ex.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {ex.blurb}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
                  <FaGithub aria-hidden className="size-3.5" />
                  View on GitHub
                  <span aria-hidden>→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

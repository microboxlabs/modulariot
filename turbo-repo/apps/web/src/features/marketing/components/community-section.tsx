import {
  HiOutlineCodeBracket,
  HiOutlineChatBubbleLeftRight,
  HiOutlineMap,
} from "react-icons/hi2";
import { FaGithub } from "react-icons/fa";
import type { ReactNode } from "react";

const REPO_URL = "https://github.com/microboxlabs/modulariot";
const ISSUES_URL = `${REPO_URL}/issues`;
const DISCUSSIONS_URL = `${REPO_URL}/discussions`;
const ROADMAP_URL = `${REPO_URL}/projects`;

type Path = {
  title: string;
  blurb: string;
  cta: string;
  href: string;
  icon: ReactNode;
  accent: "blue" | "orange" | "yellow";
};

const PATHS: Path[] = [
  {
    title: "Contribute code",
    blurb:
      "Pull requests welcome on every component — ingesters, rules, integrations, dashboards.",
    cta: "Browse open issues",
    href: ISSUES_URL,
    icon: <HiOutlineCodeBracket aria-hidden className="size-5" />,
    accent: "blue",
  },
  {
    title: "Discuss & shape",
    blurb:
      "Tell us what's missing. Operational scenarios from the field shape what we build next.",
    cta: "Join the discussion",
    href: DISCUSSIONS_URL,
    icon: <HiOutlineChatBubbleLeftRight aria-hidden className="size-5" />,
    accent: "yellow",
  },
  {
    title: "Steer the roadmap",
    blurb:
      "Public roadmap. Comment, upvote, and watch what's next — no surprise quarterly drops.",
    cta: "View the roadmap",
    href: ROADMAP_URL,
    icon: <HiOutlineMap aria-hidden className="size-5" />,
    accent: "orange",
  },
];

const ACCENT_CHIP: Record<Path["accent"], string> = {
  blue: "bg-blue-50 text-blue-500 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900/40",
  orange:
    "bg-orange-50 text-orange-500 ring-orange-200 dark:bg-orange-950/40 dark:ring-orange-900/40",
  yellow:
    "bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:ring-yellow-900/40",
};

export function CommunitySection() {
  return (
    <section
      id="open-source"
      aria-labelledby="community-heading"
      className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
            Community
          </p>
          <h2
            id="community-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Built in public.{" "}
            <span className="text-orange-500">Built with operators.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Modular IoT is grown by the people who run real fleets, real
            telemetry, real control rooms. The code is open, the roadmap is
            public, the conversation is welcoming.
          </p>
        </div>

        {/* Contributor strip — honest empty state per BRIEF "no fake social proof" */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
          <div
            aria-hidden
            className="flex -space-x-2"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="inline-block size-9 rounded-full border-2 border-white bg-gradient-to-br from-blue-200 to-orange-200 dark:border-gray-900 dark:from-blue-900 dark:to-orange-900"
              />
            ))}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Be one of the first contributors.</span>{" "}
            Early-access community is open — join while the foundations are
            being laid.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <FaGithub aria-hidden className="size-4" />
            Star and watch on GitHub
          </a>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PATHS.map((path) => (
            <li
              key={path.title}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <span
                className={`inline-flex size-9 items-center justify-center rounded-lg ring-1 ${ACCENT_CHIP[path.accent]}`}
              >
                {path.icon}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">{path.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {path.blurb}
                </p>
              </div>
              <a
                href={path.href}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex w-fit items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {path.cta}
                <span aria-hidden>→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

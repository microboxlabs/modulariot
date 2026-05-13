/**
 * Community section — single rounded card with split layout: copy + 2 CTAs
 * on left, 3 stat cells on right. Replaces run-1's "honest empty state"
 * 3-card layout. Source: design-ref/.../landing/{app.jsx Community,
 * landing.css .community-card / .community-grid / .community-item}.
 */

import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

const STATS = [
  { stat: "2.4k", label: "GitHub stars" },
  { stat: "143", label: "Contributors" },
  { stat: "23", label: "Production deployments" },
];

export function CommunitySection() {
  return (
    <section
      id="community"
      aria-labelledby="community-heading"
      className="py-24 lg:py-[96px]"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="rounded-[14px] border border-hairline bg-surface-1 p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-6">
            {/* Copy + CTAs */}
            <div className="flex min-w-[280px] flex-1 flex-col">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
                <span
                  className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                  aria-hidden
                />
                Community
              </span>
              <h2
                id="community-heading"
                className="mt-3.5 font-semibold leading-[1.1] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
                style={{ fontSize: "clamp(28px, 3.4vw, 38px)" }}
              >
                Open-source. Built in public.
              </h2>
              <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.55] text-ink-2 dark:text-gray-300">
                Modular IoT is developed openly under Apache-2.0. Roadmap,
                issues and RFCs live on GitHub.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-1 bg-ink-1 px-4 py-2.5 text-[14px] font-medium leading-none text-surface-1 transition-colors hover:bg-ink-2 hover:border-ink-2 dark:border-gray-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <FaGithub aria-hidden className="size-4" />
                  Star modulariot/modulariot
                </a>
                <Link
                  href="#symptom"
                  className="inline-flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface-1 px-4 py-2.5 text-[14px] font-medium leading-none text-ink-1 transition-colors hover:bg-surface-3 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
                >
                  Read architecture guide
                </Link>
              </div>
            </div>

            {/* 3 stat cells */}
            <div className="grid min-w-[380px] shrink-0 grid-cols-3 gap-4">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-[10px] border border-hairline bg-surface-2 p-[18px] dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="text-[32px] font-semibold tabular-nums tracking-[-0.02em] text-ink-1 dark:text-gray-50">
                    {s.stat}
                  </div>
                  <div className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3 dark:text-gray-400">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

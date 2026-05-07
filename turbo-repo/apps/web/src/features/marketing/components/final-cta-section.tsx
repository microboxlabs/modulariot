/**
 * Final CTA — dark ink-1 rounded slab, centered display headline + lede + 2 CTAs.
 * Replaces run-1's gradient-wash slab. Source: design-ref/.../landing/{app.jsx
 * FinalCTA, landing.css .final-cta}.
 */

import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

function ArrowRight({ className = "size-4" }: { className?: string }) {
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

export function FinalCtaSection() {
  return (
    <section
      id="final"
      aria-labelledby="final-heading"
      className="py-16 lg:py-[64px]"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="relative overflow-hidden rounded-2xl bg-ink-1 px-6 py-16 text-center text-surface-1 sm:px-12 lg:px-16 dark:border dark:border-hairline dark:bg-gray-900">
          <h2
            id="final-heading"
            className="font-semibold leading-[1.1] tracking-[-0.025em]"
            style={{ fontSize: "clamp(32px, 4.4vw, 52px)" }}
          >
            See it running.
          </h2>
          <p className="mx-auto mt-4 max-w-[56ch] text-[17px] leading-[1.55] text-white/70">
            20 minutes with our team. We bring a live deployment, you bring
            your hardest fleet question.
          </p>
          <div className="mt-7 inline-flex flex-wrap justify-center gap-3">
            <Link
              href="#community"
              className="inline-flex items-center gap-2 rounded-lg bg-surface-1 px-5 py-3 text-[15px] font-medium leading-none text-ink-1 transition-colors hover:bg-surface-3"
            >
              Book a 20-min demo
              <ArrowRight />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-transparent px-5 py-3 text-[15px] font-medium leading-none text-surface-1 transition-colors hover:bg-white/10"
            >
              <FaGithub aria-hidden className="size-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

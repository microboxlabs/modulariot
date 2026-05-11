import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { HeroVisual } from "./hero-visual";

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

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-[84px] pb-24"
    >
      {/* subtle 60px grid background, masked by a top-elliptical fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-hairline) 1px, transparent 1px), linear-gradient(to bottom, var(--color-hairline) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at top, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at top, black 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-16 px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* left: copy */}
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
            <span
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
            Open-source · Apache-2.0
          </span>

          <h1
            id="hero-heading"
            className="mt-[18px] text-balance font-semibold leading-[1.05] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
            style={{ fontSize: "clamp(40px, 5.6vw, 64px)" }}
          >
            Real-time signals,
            <br />
            <span className="text-ink-3 dark:text-gray-400">
              operational understanding.
            </span>
          </h1>

          <p
            className="mt-4 max-w-[56ch] text-balance text-[18px] leading-[1.55] text-ink-2 dark:text-gray-300"
          >
            Modular IoT turns raw telemetry into living symptoms — then into
            coordinated action. Open-source, composable, and deployed in your
            cloud.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            <Link
              href="#final"
              className="inline-flex items-center gap-2 rounded-lg border border-ink-1 bg-ink-1 px-5 py-3 text-[15px] font-medium leading-none text-surface-1 transition-colors hover:bg-ink-2 hover:border-ink-2 dark:border-gray-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Book a 20-min demo
              <ArrowRight />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface-1 px-5 py-3 text-[15px] font-medium leading-none text-ink-1 transition-colors hover:bg-surface-3 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
            >
              <FaGithub aria-hidden className="size-4" />
              View on GitHub
            </a>
          </div>

          <div className="mt-6 inline-flex flex-wrap items-center gap-4 text-[13px] text-ink-3 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full bg-action"
                style={{ animation: "live-pulse 2s ease-out infinite" }}
                aria-hidden
              />
              Live since 2024
            </span>
            <span
              className="inline-block size-1 rounded-full bg-ink-4"
              aria-hidden
            />
            <span>23 active deployments</span>
            <span
              className="inline-block size-1 rounded-full bg-ink-4"
              aria-hidden
            />
            <span>Built from real fleet operations</span>
          </div>
        </div>

        {/* right: terminal-window pipeline visual */}
        <div>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { HiArrowRight, HiOutlineBookOpen } from "react-icons/hi2";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

export function FinalCtaSection() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="relative overflow-hidden bg-gray-950 text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_30%,theme(colors.blue.500/0.25),transparent_60%),radial-gradient(50%_60%_at_75%_70%,theme(colors.orange.500/0.20),transparent_70%)]"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6 lg:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-orange-400" aria-hidden />
          Open-source · early access
        </span>

        <h2
          id="cta-heading"
          className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          From telemetry to symptoms{" "}
          <span className="bg-gradient-to-r from-blue-300 to-orange-300 bg-clip-text text-transparent">
            in five minutes.
          </span>
        </h2>

        <p className="max-w-xl text-base text-gray-300">
          Clone the repo. Boot the stack. Post a signal. Watch it become a
          symptom your team can actually act on. Stay on your cloud — your data
          never leaves.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#quickstart"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-400"
          >
            See it running
            <HiArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="#docs"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
          >
            <HiOutlineBookOpen aria-hidden className="size-4" />
            Read the docs
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
          >
            <FaGithub aria-hidden className="size-4" />
            Star on GitHub
          </a>
        </div>

        <p className="text-xs text-gray-400">
          MIT-licensed · Self-host on your cloud · No SaaS sign-up required
        </p>
      </div>
    </section>
  );
}

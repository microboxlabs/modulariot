"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FaGithub } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

export function HeroSection() {
  const reduce = useReducedMotion();

  const fadeUp = (delay = 0) =>
    reduce
      ? { initial: false, animate: false }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden"
    >
      {/* subtle pattern wash, brand colors */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_30%_20%,theme(colors.blue.500/0.12),transparent_60%),radial-gradient(40%_50%_at_85%_80%,theme(colors.orange.500/0.10),transparent_70%)]"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <motion.span
            {...fadeUp(0)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />
            Open-source · real-time · symptom intelligence
          </motion.span>

          <motion.h1
            id="hero-heading"
            {...fadeUp(0.05)}
            className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          >
            Open-source real-time monitoring,{" "}
            <span className="bg-gradient-to-r from-blue-500 to-orange-500 bg-clip-text text-transparent">
              built around symptoms.
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.1)}
            className="max-w-xl text-lg text-gray-600 dark:text-gray-300"
          >
            Modular IoT captures live signals, turns them into symptoms with
            state, severity, and treatment, and gives operators evidence they
            can act on. Own your data. Own your stack. Own your control tower.
          </motion.p>

          <motion.div {...fadeUp(0.15)} className="flex flex-wrap gap-3 pt-2">
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600"
            >
              See it running
              <HiArrowRight aria-hidden className="size-4" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
            >
              <FaGithub aria-hidden className="size-4" />
              Explore the repo
            </a>
          </motion.div>

          <motion.p
            {...fadeUp(0.2)}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            Self-host on your cloud · Deploy with docker compose · MIT-licensed
          </motion.p>
        </div>

        <motion.div
          {...fadeUp(0.1)}
          className="relative lg:col-span-5"
        >
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <Image
              src="/brand/hero-pipeline.svg"
              alt="Telemetry flowing through Modular IoT pipeline"
              width={400}
              height={300}
              priority
              className="h-auto w-full"
            />
            {!reduce ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-12 animate-[pipeline-sweep_4.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10"
              />
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* keyframes scoped via Tailwind arbitrary values; no JS needed */}
      <style>{`
        @keyframes pipeline-sweep {
          0% { transform: translateX(0%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(900%); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

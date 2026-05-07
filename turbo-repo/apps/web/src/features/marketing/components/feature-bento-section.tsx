import {
  HiOutlineBolt,
  HiOutlineChartBar,
  HiOutlineCloud,
  HiOutlineCodeBracket,
  HiOutlineCog6Tooth,
  HiOutlineDocumentText,
  HiOutlineSparkles,
} from "react-icons/hi2";
import type { ReactNode } from "react";
import Link from "next/link";

type Card = {
  title: string;
  blurb: string;
  icon: ReactNode;
  accent: "blue" | "orange" | "yellow" | "gray";
  /** Desktop column span (out of 12). Mobile and tablet auto-stack. */
  span: 4 | 6 | 8;
  href?: string;
  ctaLabel?: string;
};

const ACCENT_RING: Record<Card["accent"], string> = {
  blue: "text-blue-500",
  orange: "text-orange-500",
  yellow: "text-yellow-500",
  gray: "text-gray-500",
};

const CARDS: Card[] = [
  {
    title: "Symptom Intelligence engine",
    blurb:
      "Turn raw signals into operational symptoms with state, severity, ownership, and treatment. The engine that makes Modular IoT different from a dashboard with alerts.",
    icon: <HiOutlineSparkles aria-hidden className="size-7" />,
    accent: "orange",
    span: 8,
    href: "#symptoms",
    ctaLabel: "Learn how it works",
  },
  {
    title: "Real-time ingestion",
    blurb:
      "Capture telemetry from any source — GPS, MQTT, Kafka, webhooks, SDK.",
    icon: <HiOutlineBolt aria-hidden className="size-6" />,
    accent: "blue",
    span: 4,
  },
  {
    title: "Live operations dashboards",
    blurb:
      "Map, timeline, and incident views. Drill from fleet to single device in one click.",
    icon: <HiOutlineChartBar aria-hidden className="size-6" />,
    accent: "blue",
    span: 4,
  },
  {
    title: "Workflow orchestration",
    blurb:
      "Trigger treatments, route to the right team, coordinate response across the tools you already use.",
    icon: <HiOutlineCog6Tooth aria-hidden className="size-6" />,
    accent: "yellow",
    span: 4,
  },
  {
    title: "Audit-ready evidence",
    blurb:
      "Every signal, symptom, and action lands in a queryable trail. Built for regulators and post-mortems.",
    icon: <HiOutlineDocumentText aria-hidden className="size-6" />,
    accent: "gray",
    span: 4,
  },
  {
    title: "Bring your own cloud",
    blurb:
      "Self-host with docker compose, Helm, or Kubernetes. MIT-licensed. Your data stays in your infrastructure.",
    icon: <HiOutlineCloud aria-hidden className="size-6" />,
    accent: "blue",
    span: 6,
  },
  {
    title: "Developer APIs & SDKs",
    blurb:
      "REST and WebSocket APIs for ingestion, queries, and orchestration. SDKs that fit your stack.",
    icon: <HiOutlineCodeBracket aria-hidden className="size-6" />,
    accent: "gray",
    span: 6,
  },
];

const SPAN_CLASS: Record<Card["span"], string> = {
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
};

export function FeatureBentoSection() {
  return (
    <section
      id="product"
      aria-labelledby="bento-heading"
      className="bg-white dark:bg-gray-900"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Product primitives
          </p>
          <h2
            id="bento-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Replaceable components around a{" "}
            <span className="text-blue-500">consistent operational model.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Modular IoT is not a single monolith. Each primitive is a building
            block — swap one out, the rest keeps running.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {CARDS.map((card, index) => {
            const isHero = index === 0;
            return (
              <article
                key={card.title}
                className={[
                  SPAN_CLASS[card.span],
                  "group relative flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-6 transition-colors dark:border-gray-800 dark:bg-gray-950",
                  isHero
                    ? "bg-gradient-to-br from-orange-50 via-gray-50 to-blue-50 dark:from-orange-950/30 dark:via-gray-950 dark:to-blue-950/30"
                    : "hover:border-gray-300 dark:hover:border-gray-700",
                ].join(" ")}
              >
                <div className={ACCENT_RING[card.accent]}>{card.icon}</div>

                <div className="flex flex-col gap-2">
                  <h3
                    className={
                      isHero
                        ? "text-2xl font-semibold tracking-tight"
                        : "text-lg font-semibold"
                    }
                  >
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {card.blurb}
                  </p>
                </div>

                {card.href ? (
                  <Link
                    href={card.href}
                    className="mt-auto inline-flex w-fit items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    {card.ctaLabel ?? "Learn more"}
                    <span aria-hidden>→</span>
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";

type Stat = { label: string; value: string; tone: "blue" | "orange" | "yellow" | "gray" };

const STATS: Stat[] = [
  { label: "Devices online", value: "1,247", tone: "blue" },
  { label: "Active symptoms", value: "14", tone: "orange" },
  { label: "Resolved today", value: "47", tone: "yellow" },
  { label: "Healthy fleet", value: "98.9%", tone: "gray" },
];

const TONE_RING: Record<Stat["tone"], string> = {
  blue: "ring-blue-200 text-blue-600 dark:ring-blue-900/40 dark:text-blue-400",
  orange:
    "ring-orange-200 text-orange-600 dark:ring-orange-900/40 dark:text-orange-400",
  yellow:
    "ring-yellow-200 text-yellow-700 dark:ring-yellow-900/40 dark:text-yellow-400",
  gray: "ring-gray-200 text-gray-600 dark:ring-gray-800 dark:text-gray-400",
};

export function DashboardShowcaseSection() {
  return (
    <section
      id="dashboards"
      aria-labelledby="dashboards-heading"
      className="bg-white dark:bg-gray-900"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
            Operations view
          </p>
          <h2
            id="dashboards-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            One glance.{" "}
            <span className="text-orange-500">Every active symptom.</span>
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-300">
            The control-tower view: every fleet, every device, every symptom in
            flight — with the evidence trail one click away.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 via-white to-orange-50 p-4 shadow-lg sm:p-6 dark:border-gray-800 dark:from-blue-950/30 dark:via-gray-950 dark:to-orange-950/30">
          {/* status chip strip */}
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((stat) => (
              <li
                key={stat.label}
                className={`flex flex-col gap-0.5 rounded-lg bg-white p-3 ring-1 dark:bg-gray-900 ${TONE_RING[stat.tone]}`}
              >
                <span className="text-xl font-semibold tabular-nums">
                  {stat.value}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>

          {/* primary canvas: map + timeline */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <figure className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 lg:col-span-7 dark:border-gray-800 dark:bg-gray-950">
              <figcaption className="flex items-center justify-between text-xs text-gray-500">
                <span>Fleet map · live</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden />
                  3 incidents in last 5 min
                </span>
              </figcaption>
              <Image
                src="/brand/showcase/dashboard-map.svg"
                alt="Live fleet map showing device locations and active incidents"
                width={600}
                height={400}
                className="h-auto w-full rounded-md"
              />
            </figure>

            <figure className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 lg:col-span-5 dark:border-gray-800 dark:bg-gray-950">
              <figcaption className="flex items-center justify-between text-xs text-gray-500">
                <span>Symptom timeline · last 24h</span>
                <span className="text-orange-500">14 active</span>
              </figcaption>
              <Image
                src="/brand/showcase/symptom-timeline.svg"
                alt="Symptom timeline showing severity and lifecycle of recent incidents"
                width={400}
                height={400}
                className="h-auto w-full rounded-md"
              />
            </figure>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Composite mock — your operations view is configurable per fleet, per
          tenant, and per role. The data behind every visualization stays in
          your infrastructure.
        </p>
      </div>
    </section>
  );
}

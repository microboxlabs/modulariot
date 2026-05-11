/**
 * Symptom narrative — dense 5-column data-flow diagram. The conceptual heart
 * of the page: every step is a column, every row is a real telemetry artifact.
 *
 * Design source: design-ref/.../landing/{app.jsx SymptomNarrative, landing.css
 * .symptom-stage / .symptom-step / .row / .flow-arrow}, i18n.jsx t.symptom.
 */

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  rows: string[];
  /** Colored row dot (per design: signal/signal-light/amber/green/gray). */
  tone: string;
};

const STEPS: Step[] = [
  {
    eyebrow: "01 · Capture",
    title: "Signals",
    body:
      "Raw telemetry: GPS pings, sensor reads, driver events. High volume, noisy, inert.",
    rows: [
      "gps.lat 23.6438",
      "speed 87 km/h",
      "rpm 2840",
      "temp.engine 91°C",
      "accel −0.42 g",
    ],
    tone: "#3F83F8",
  },
  {
    eyebrow: "02 · Stream",
    title: "Behaviors",
    body:
      "Patterns derived in motion: trends, anomalies, sequences. Still neutral, not yet meaning.",
    rows: [
      "braking.harsh × 3",
      "speed.over_limit",
      "lane.deviation",
      "geofence.near_exit",
    ],
    tone: "#76A9FA",
  },
  {
    eyebrow: "03 · Identify",
    title: "Symptoms",
    body:
      "Stateful operational concepts. They have severity, evolve, can be treated, audited.",
    rows: [
      "Driver fatigue · open · sev 2",
      "Geofence exit · open · sev 3",
      "Engine overheat · watch",
    ],
    tone: "#F59E0B",
  },
  {
    eyebrow: "04 · Orchestrate",
    title: "Treatments",
    body:
      "Workflows triggered by symptoms — dispatch, escalations, holds, contact attempts.",
    rows: [
      "sms → supervisor",
      "task → control tower",
      "trip.hold pending ack",
      "audio → cabin",
    ],
    tone: "#0E9F6E",
  },
  {
    eyebrow: "05 · Audit",
    title: "Evidence",
    body:
      "Every signal, decision and action persists. A defensible operational record.",
    rows: [
      "incident #4821 · resolved",
      "ack by O. Mendoza · 14:32",
      "trail · 312 events",
      "compliance: ISO 39001",
    ],
    tone: "#6B7280",
  },
];

function FlowArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function TelemetrySymptomsSection() {
  return (
    <section
      id="symptom"
      aria-labelledby="symptom-heading"
      className="py-24 lg:py-[96px]"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        {/* section head */}
        <div className="max-w-[720px]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
            <span
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
            The conceptual heart
          </span>
          <h2
            id="symptom-heading"
            className="mt-[18px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink-1 dark:text-gray-50"
            style={{ fontSize: "clamp(30px, 3.8vw, 46px)" }}
          >
            From signals to symptoms to action
          </h2>
          <p className="mt-[14px] max-w-[56ch] text-balance text-[17px] leading-[1.55] text-ink-2 dark:text-gray-300">
            Most platforms stop at alerts. Modular IoT models a five-stage
            lifecycle that gives operations a vocabulary for what is actually
            happening — and a record of what was done about it.
          </p>
        </div>

        {/* 5-col stage */}
        <ol className="mt-14 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {STEPS.map((step, idx) => (
            <li
              key={step.title}
              className="relative flex min-h-[240px] flex-col rounded-xl border border-hairline bg-surface-1 p-[18px] dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-4 dark:text-gray-500">
                {step.eyebrow}
              </div>
              <div
                className="mb-1 text-[16px] font-semibold tracking-[-0.01em] text-ink-1 dark:text-gray-50"
              >
                {step.title}
              </div>
              <p className="text-[12px] leading-[1.5] text-ink-3 dark:text-gray-400">
                {step.body}
              </p>

              <div className="mt-3 flex flex-1 flex-col gap-1.5">
                {step.rows.map((row) => (
                  <div
                    key={row}
                    className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-2 py-[5px] font-mono text-[11px] text-ink-2 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                  >
                    <span
                      className="inline-block size-1.5 shrink-0 rounded-full"
                      style={{ background: step.tone }}
                      aria-hidden
                    />
                    {row}
                  </div>
                ))}
              </div>

              {/* flow arrow between columns (lg+ only) */}
              {idx < STEPS.length - 1 ? (
                <span className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-ink-4 lg:inline-block dark:text-gray-600">
                  <FlowArrow />
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        {/* Insight footnote */}
        <div className="mt-8 flex items-center gap-3 rounded-[10px] border border-hairline bg-surface-2 px-5 py-4 text-[13.5px] text-ink-2 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          <span
            className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          >
            Insight
          </span>
          <span>
            A symptom is not just an alert — it has state, severity, owners,
            and outcomes.
          </span>
        </div>
      </div>
    </section>
  );
}

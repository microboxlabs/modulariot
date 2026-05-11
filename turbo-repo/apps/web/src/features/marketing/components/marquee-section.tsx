/**
 * MarqueeSection — scrolling strip of tenant names that positions Modular IoT
 * as a multi-tenant platform with real production deployments. Replaces the
 * generic "Built for logistics" trust strip from run-1.
 *
 * Design source: design-ref/.../landing/{app.jsx Marquee, landing.css .marquee-*}.
 * The 9 tenants are real Mintral / MBL deployments — keep them in this order.
 */
const TENANTS = [
  "MINTRAL",
  "GAMA",
  "SQM",
  "CCU",
  "MELÓN",
  "SITRANS",
  "ULTRAMAR",
  "FLOTA NORTE",
  "MICROBOXLABS",
] as const;

// Double the list so the 50% translate looks seamless.
const ITEMS = [...TENANTS, ...TENANTS];

export function MarqueeSection() {
  return (
    <section
      aria-label="Tenants in production"
      className="overflow-hidden border-y border-hairline bg-surface-1 py-7 dark:border-gray-800 dark:bg-gray-900"
    >
      <p className="mb-[18px] text-center text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3 dark:text-gray-400">
        Built for logistics, fleet operations, mining and industrial telemetry
      </p>
      <div
        className="flex w-max items-center gap-16"
        style={{
          animation: "marquee 30s linear infinite",
        }}
      >
        {ITEMS.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="inline-flex items-center gap-2.5 whitespace-nowrap font-display text-[18px] font-bold uppercase tracking-[0.1em] text-ink-3 opacity-70 dark:text-gray-400"
          >
            {name}
            <span className="font-sans text-[10px] font-medium tracking-[0.08em] text-ink-4 dark:text-gray-500">
              / tenant
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

import { getContent } from "../content";

// Cierre del DS: panel en tinta dentro de la página (no banda a sangre),
// botón blanco, cifras tabulares.
export function FinalCta({ lang }: { lang: string }) {
  const c = getContent(lang).finalCta;
  return (
    <section id="contacto" className="scroll-mt-16 bg-page">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
        <div className="rounded-2xl border border-ink-1 bg-ink-1 px-8 py-14 text-center sm:px-16 dark:border-hairline dark:bg-surface">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-[-0.025em] text-page sm:text-4xl dark:text-ink-1">
            {c.title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-page/70 dark:text-ink-2">{c.body}</p>
          <a
            href={`/alpha-2506/${lang}/contacto?intent=demo`}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3.5 text-[15px] font-medium text-gray-950 transition-colors hover:bg-gray-100"
          >
            {c.cta}
          </a>
          <p className="mt-4 text-sm text-page/60 dark:text-ink-3">{c.note}</p>
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-10 dark:border-hairline">
            {c.stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-semibold tracking-[-0.02em] text-page tabular-nums sm:text-3xl dark:text-ink-1">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-page/60 sm:text-sm dark:text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { getContent } from "../content";
import { Counter } from "../Counter";
import { Reveal } from "../Reveal";

// Banda de validación: cifras de una operación real, en el trato del DS —
// tabulares, tinta sobre superficie alterna, sin banda oscura.
export function Stats({ lang }: { lang: string }) {
  const c = getContent(lang).stats;
  return (
    <section className="border-y border-hairline bg-page-alt">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {c.items.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <p className="text-sm text-ink-3">{s.prefix}</p>
              <p className="display mt-1 text-4xl tabular-nums sm:text-5xl">
                <Counter value={s.value} />
              </p>
              <p className="mt-2 text-xs font-medium tracking-[0.08em] text-ink-3 uppercase">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

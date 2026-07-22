import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

export function Stories({ lang }: { lang: string }) {
  const c = getContent(lang).stories;
  return (
    <Section id="clientes" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <Reveal className="mt-12 grid grid-cols-2 gap-6 rounded-[14px] border border-hairline bg-surface px-6 py-7 sm:grid-cols-4">
        {c.metrics.map((m) => (
          <div key={m.label}>
            <p className="display text-3xl tabular-nums">{m.value}</p>
            <p className="mt-1 text-xs font-medium tracking-[0.08em] text-ink-3 uppercase">{m.label}</p>
          </div>
        ))}
      </Reveal>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {c.cases.map((cs, i) => (
          <Reveal key={cs.tag} delay={i * 0.1} className="rounded-[14px] border border-hairline bg-surface p-7">
            <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
              Caso real · {cs.tag}
            </span>
            <div className="mt-6 space-y-5">
              <div>
                <p className="font-mono text-[11px] tracking-[0.12em] text-ink-4 uppercase">Antes</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{cs.before}</p>
              </div>
              <div className="border-l-2 border-accent pl-4">
                <p className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase">Con ModularIoT</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-1">{cs.after}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {c.quotes.map((q, i) => (
          <Reveal key={q.author} delay={i * 0.1} as="div">
            <figure className="h-full rounded-[14px] border border-ink-1 bg-ink-1 p-7 dark:border-hairline dark:bg-surface">
              <blockquote className="text-lg leading-relaxed font-medium text-page dark:text-ink-1">
                “{q.text}”
              </blockquote>
              <figcaption className="mt-4 text-sm text-page/60 dark:text-ink-3">— {q.author}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

export function Problem({ lang }: { lang: string }) {
  const c = getContent(lang).problem;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {c.pains.map((p, i) => (
          <Reveal
            key={p.title}
            delay={i * 0.1}
            className="rounded-xl border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong"
          >
            <blockquote className="text-lg leading-snug font-semibold text-ink-1 italic">{p.title}</blockquote>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

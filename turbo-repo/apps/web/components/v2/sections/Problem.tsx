import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

export function Problem({ lang }: { lang: string }) {
  const c = getContent(lang).problem;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {c.pains.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.1} className="rounded-xl border border-gray-200 bg-white p-4">
            <blockquote className="text-xl font-semibold italic leading-snug text-gray-950">{p.title}</blockquote>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

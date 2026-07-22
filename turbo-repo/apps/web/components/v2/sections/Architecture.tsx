import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

export function Architecture({ lang }: { lang: string }) {
  const c = getContent(lang).architecture;
  return (
    <Section id="arquitectura" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {c.steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12} className="relative rounded-xl border border-gray-200 bg-white p-8">
            <span className="text-5xl font-extrabold text-gray-200">{s.n}</span>
            <h3 className="mt-4 text-xl font-bold text-gray-950">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-gray-600">{s.body}</p>
            {i < c.steps.length - 1 && (
              <svg className="absolute top-1/2 -right-5 hidden h-6 w-6 -translate-y-1/2 text-gray-300 md:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-10 max-w-2xl rounded-xl bg-gray-950 p-8 text-center">
        <p className="text-2xl font-bold text-blue-600">{c.latency}</p>
        <p className="mt-2 text-sm text-gray-400">{c.latencySubtitle}</p>
      </Reveal>
    </Section>
  );
}

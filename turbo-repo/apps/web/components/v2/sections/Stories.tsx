import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader } from "./shared";

export function Stories({ lang }: { lang: string }) {
  const c = getContent(lang).stories;
  return (
    <Section id="clientes" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <Reveal className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-6 rounded-xl border border-gray-200 bg-white px-6 py-8 sm:grid-cols-4">
        {c.metrics.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-3xl font-extrabold tracking-tight text-gray-950">{m.value}</p>
            <p className="mt-1 text-xs leading-snug text-gray-500">{m.label}</p>
          </div>
        ))}
      </Reveal>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {c.cases.map((cs, i) => (
          <Reveal key={cs.tag} delay={i * 0.1} className="rounded-xl border border-gray-200 bg-white p-8">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Caso real · {cs.tag}
            </span>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Antes</p>
                <p className="mt-2 leading-relaxed text-gray-600">{cs.before}</p>
              </div>
              <div className="border-l-2 border-blue-600 pl-4">
                <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">Con ModularIoT</p>
                <p className="mt-2 leading-relaxed text-gray-800">{cs.after}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {c.quotes.map((q, i) => (
          <Reveal key={q.author} delay={i * 0.1} as="div">
            <figure className="rounded-xl bg-gray-950 p-8 text-white">
              <blockquote className="text-lg leading-relaxed font-medium">“{q.text}”</blockquote>
              <figcaption className="mt-4 text-sm text-gray-400">— {q.author}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

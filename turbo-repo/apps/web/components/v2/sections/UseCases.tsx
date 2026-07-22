import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { ConceptGraphic } from "../ConceptGraphic";
import { Section, SectionHeader, Check } from "./shared";

export function UseCases({ lang }: { lang: string }) {
  const c = getContent(lang).useCases;
  return (
    <Section id="casos-de-uso" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {c.cards.map((card, i) => (
          <Reveal key={card.id} delay={i * 0.08} className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
            <div className="overflow-hidden">
              <div className="transition-transform duration-500">
                <ConceptGraphic id={card.id} />
              </div>
            </div>
            <div className="flex-1 p-6">
              <h3 className="text-xl font-bold text-gray-950">{card.title}</h3>
              <p className="leading-relaxed text-gray-600">{card.body}</p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 text-blue-600" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

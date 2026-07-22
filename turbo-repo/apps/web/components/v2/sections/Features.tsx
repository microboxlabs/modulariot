import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, Icon, Check } from "./shared";

export function Features({ lang }: { lang: string }) {
  const c = getContent(lang).features;
  return (
    <Section id="caracteristicas" tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {c.cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.1} className="flex flex-col rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-md">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon name={card.icon} className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-950">{card.title}</h3>
            <p className="mt-3 leading-relaxed text-gray-600">{card.body}</p>
            <ul className="mt-5 space-y-2">
              {card.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="mt-0.5 text-blue-600" />
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

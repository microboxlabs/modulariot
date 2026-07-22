import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { ConceptGraphic } from "../ConceptGraphic";
import { Section, SectionHeader, Check } from "./shared";

export function UseCases({ lang }: { lang: string }) {
  const c = getContent(lang).useCases;
  return (
    <Section id="casos-de-uso" tone="gray">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {c.cards.map((card, i) => (
          <Reveal
            key={card.id}
            delay={i * 0.08}
            className="flex flex-col overflow-hidden rounded-[14px] border border-hairline bg-surface transition-colors hover:border-hairline-strong"
          >
            <div className="border-b border-hairline">
              <ConceptGraphic id={card.id} />
            </div>
            <div className="flex-1 p-6">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink-1">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{card.body}</p>
              <ul className="mt-5 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-ink-2">
                    <Check className="mt-0.5 text-accent" />
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

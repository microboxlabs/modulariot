import { getContent } from "../content";
import { Section, SectionHeader, Check } from "./shared";

export function PainOutcome({ lang }: { lang: string }) {
  const c = getContent(lang).painOutcome;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <div className="mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
        <div className="rounded-[14px] border border-hairline bg-surface p-7">
          <h3 className="text-base font-semibold text-ink-3">{c.left.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.left.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[14px] border-2 border-accent bg-surface p-7">
          <h3 className="text-base font-semibold text-ink-1">{c.right.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.right.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink-1">
                <Check className="mt-0.5 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

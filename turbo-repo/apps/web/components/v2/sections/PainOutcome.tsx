import { getContent } from "../content";
import { Section, SectionHeader, Check } from "./shared";

export function PainOutcome({ lang }: { lang: string }) {
  const c = getContent(lang).painOutcome;
  return (
    <Section tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} />
      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <h3 className="text-lg font-bold text-gray-500">{c.left.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.left.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-500">
                <svg className="mt-1 h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border-2 border-blue-600 bg-white p-8 shadow-lg">
          <h3 className="text-lg font-bold text-gray-950">{c.right.title}</h3>
          <ul className="mt-5 space-y-3">
            {c.right.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-800">
                <Check className="mt-1 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

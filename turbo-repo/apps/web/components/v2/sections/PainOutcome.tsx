import { getContent } from "../content";
import { Section, Check } from "./shared";
import { Reveal } from "../Reveal";

export function PainOutcome({ lang }: { lang: string }) {
  const c = getContent(lang).painOutcome;
  return (
    <Section tone="white" className="flex flex-col gap-8">
      <Reveal className="order-1 text-center">
        <p className="mb-4 text-sm font-semibold tracking-widest text-blue-600 uppercase">{c.kicker}</p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">{c.title}</h2>
      </Reveal>
      <div className="grid items-center mt-10">
        <div className="order-2 grid overflow-hidden rounded-xl border border-gray-200 bg-white sm:grid-cols-2 lg:order-1 lg:col-span-2">
          <div className="p-8">
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
          <div className="border-t-2 border-blue-600 bg-blue-50/40 p-8 sm:border-t-0 sm:border-l-2">
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
      </div>
    </Section>
  );
}

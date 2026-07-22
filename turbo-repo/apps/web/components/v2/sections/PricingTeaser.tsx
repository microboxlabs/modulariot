import { getContent } from "../content";
import { Section } from "./shared";

export function PricingTeaser({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).pricingTeaser;
  return (
    <Section tone="white">
      <div className="rounded-2xl bg-gray-950 p-10 text-center sm:p-16">
        <p className="mb-4 text-sm font-semibold tracking-widest text-blue-400 uppercase">{c.kicker}</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">{c.title}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">{c.subtitle}</p>
        <a
          href={`${base}/precios`}
          className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-blue-700"
        >
          {c.cta}
        </a>
      </div>
    </Section>
  );
}

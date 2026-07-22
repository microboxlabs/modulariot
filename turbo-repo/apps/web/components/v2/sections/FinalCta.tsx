import { getContent } from "../content";

export function FinalCta({ lang }: { lang: string }) {
  const c = getContent(lang).finalCta;
  return (
    <section id="contacto" className="scroll-mt-16 bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">{c.title}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">{c.body}</p>
        <a
          href={`/alpha-2506/${lang}/contacto?intent=demo`}
          className="mt-10 inline-block rounded-lg bg-blue-600 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-blue-700"
        >
          {c.cta}
        </a>
        <p className="mt-5 text-sm text-gray-400">{c.note}</p>
        <div className="mt-12 grid grid-cols-3 gap-6 border-t border-gray-800 pt-10">
          {c.stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-extrabold text-white sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-gray-400 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

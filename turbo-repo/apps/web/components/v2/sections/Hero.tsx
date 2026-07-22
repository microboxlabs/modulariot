import { getContent } from "../content";
import HeroTerminal from "../HeroTerminal";

export function Hero({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).hero;
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:pt-28 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-12">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-block rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-600">
              {c.kicker}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 sm:text-6xl lg:text-5xl">
              {c.titlePre}
              <span className="relative inline-block px-1">
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[0.12em] top-[0.18em] -z-10 -rotate-1 rounded-[0.15em] bg-yellow-300"
                />
                {c.titleHighlight}
              </span>
              {c.titlePost}
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 lg:mx-0">{c.subtitle}</p>
            <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
              <a
                href="#contacto"
                className="w-full rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
              >
                {c.ctaPrimary}
              </a>
              <a
                href={`${base}/precios`}
                className="w-full rounded-lg border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-950 transition-colors hover:border-gray-950 sm:w-auto"
              >
                {c.ctaSecondary}
              </a>
            </div>
          </div>

          {/* Pipeline en vivo (animado) */}
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}

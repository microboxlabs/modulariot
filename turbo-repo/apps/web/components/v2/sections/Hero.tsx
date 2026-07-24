import { getTranslations } from "next-intl/server";
import HeroTerminal from "../HeroTerminal";
import { Eyebrow, btnPrimary, btnLg } from "./shared";

// Subrayado de firma: la cinta del pico del Lynx (chevrón 1:2, grosor a/16)
// tendida bajo el verbo del titular. Ámbar de marca, se adapta al tema.
function AmberChevron({ children }: { children: React.ReactNode }) {
  return (
    <span className="amber-chevron">
      {children}
      <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 2 L50 8 L100 2 L100 6 L50 12 L0 6 Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export async function Hero({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: "hero" });
  return (
    <section className="relative overflow-hidden bg-page">
      <div className="hero-bg" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-16 lg:pt-21 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Eyebrow>{t("kicker")}</Eyebrow>
            <h1 className="display mt-5 text-[clamp(40px,3.5vw,64px)] leading-[1.05]">
              {t("titlePre")}
              <AmberChevron>{t("titleHighlight")}</AmberChevron>
              {t("titlePost")}
            </h1>
            <p className="mt-5 max-w-[56ch] text-lg leading-[1.55] text-ink-2">{t("subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <a href="#contacto" className={`${btnPrimary} ${btnLg}`}>
                {t("ctaPrimary")}
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

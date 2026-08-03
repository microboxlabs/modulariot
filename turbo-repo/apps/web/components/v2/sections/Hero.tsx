import { getTranslations } from "next-intl/server";
import HeroTerminal from "../HeroTerminal";
import { LynxMark } from "../brand/Logo";
import { Eyebrow, Section, btnPrimary, btnLg, type Tone } from "./shared";

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

export async function Hero({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "hero" });
  return (
    <Section tone={tone} contentClassName="pt-16 pb-16 lg:pt-21 lg:pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Eyebrow>{t("kicker")}</Eyebrow>
          <h1 className="display mt-5 text-[clamp(40px,3.5vw,64px)] leading-[1.05]">
            {t("titlePre")}
            <AmberChevron>{t("titleHighlight")}</AmberChevron>
          </h1>
          <p className="text-ink-2 mt-5 max-w-[56ch] text-lg leading-[1.55]">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <a href="#contacto" className={`${btnPrimary} ${btnLg}`}>
              {t("ctaPrimary")}
            </a>
          </div>
        </div>

        {/* Pipeline en vivo (animado) — el Lynx asoma detrás, "cortado" por
            la tarjeta del terminal (que es opaca), centrado en la columna. */}
        <div className="relative">
          <LynxMark
            aria-hidden
            className="text-ink-1 pointer-events-none absolute top-3/5 left-0 hidden h-[120%] w-[120%] translate-x-[-70%] -translate-y-1/2 -rotate-12 opacity-[0.06] lg:block"
          />
          <div className="relative z-10">
            <HeroTerminal />
          </div>
        </div>
      </div>
    </Section>
  );
}

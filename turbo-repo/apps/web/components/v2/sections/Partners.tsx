import { getTranslations } from "next-intl/server";
import { Section, type Tone } from "./shared";
import { CLIENT_LOGOS, GPS_PARTNERS } from "../partners-data";
import type { PartnerLogo } from "../partners-data.types";

// Trust bar en dos planos (motion demo-led): el carrusel infinito lleva las
// integraciones GPS bajo "Integrado con" — no son clientes, son proveedores
// integrados — y los clientes reales van aparte, estáticos, bajo "Confiado
// por". Solo logos; cada uno linkea al sitio oficial.

// `invert` marca logos de arte blanco/negro puro (no a color): en claro se
// invierten solo si son blancos (`p.invert`), en oscuro es al revés — los
// blancos ya se ven bien tal cual (dark:invert-0 cancela el invert) y los
// negros necesitan invertirse para no quedar negro-sobre-negro
// (dark:invert). Los logos a color no llevan ninguna de las dos clases, así
// no se les distorsiona el color de marca en ningún tema.
function LogoLi({ p, duplicate }: { p: PartnerLogo; duplicate: boolean }) {
  const themeInvert = p.invert ? "invert dark:invert-0" : "dark:invert";
  const height = p.tall ? "h-14" : "h-10";
  const inner = p.img ? (
    <img
      src={p.img}
      alt={p.name}
      className={`${height} w-auto ${themeInvert}`}
    />
  ) : (
    <span className="text-ink-3 text-[19px] font-bold tracking-tight whitespace-nowrap">
      {p.name}
    </span>
  );
  const hover = p.invert
    ? "hover:opacity-100"
    : "hover:opacity-100 hover:grayscale-0 dark:hover:grayscale";
  return (
    <li className="mx-8 shrink-0">
      {p.href ? (
        <a
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.name}
          title={p.name}
          tabIndex={duplicate ? -1 : undefined}
          className={`block opacity-55 grayscale transition duration-200 ${hover}`}
        >
          {inner}
        </a>
      ) : (
        <span title={p.name} className="block opacity-55 grayscale">
          {inner}
        </span>
      )}
    </li>
  );
}

function Track({
  items,
  reverse,
  duration,
}: {
  items: readonly PartnerLogo[];
  reverse?: boolean;
  duration: number;
}) {
  return (
    <div className="miot-marquee group relative overflow-hidden">
      <div
        className="miot-marquee-track flex w-max items-center"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center"
          >
            {items.map((p) => (
              <LogoLi key={p.name} p={p} duplicate={copy === 1} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export async function Partners({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "stats" });
  return (
    <Section tone={tone} contentClassName="space-y-7 py-10">
      <style>{`
        .miot-marquee { -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .miot-marquee-track { animation: miot-marquee-scroll linear infinite; }
        .miot-marquee:hover .miot-marquee-track, .miot-marquee:focus-within .miot-marquee-track { animation-play-state: paused; }
        @keyframes miot-marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .miot-marquee-track { animation: none; } }
      `}</style>
      <p className="text-ink-3 text-center text-xs font-semibold tracking-widest uppercase">
        {t("integratedWith")}
      </p>
      <Track items={GPS_PARTNERS} duration={80} />
      <div className="flex flex-col items-center gap-5 pt-3">
        <p className="text-ink-3 text-center text-xs font-semibold tracking-widest uppercase">
          {t("trustedBy")}
        </p>
        <ul className="flex flex-wrap items-center justify-center">
          {CLIENT_LOGOS.map((p) => (
            <LogoLi key={p.name} p={p} duplicate={false} />
          ))}
        </ul>
      </div>
    </Section>
  );
}

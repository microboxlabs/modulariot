import { Section, type Tone } from "./shared";
import { GPS_PARTNERS, TECH_PARTNERS, type PartnerLogo } from "../partners-data";

// Trust bar de integraciones (motion demo-led): dos carruseles infinitos en
// contrarrotación — proveedores GPS integrados y plataformas tecnológicas.
// Solo logos; cada uno linkea al sitio oficial. Los logos blancos (invert)
// se invierten sobre fondo claro y no revelan color al hover (el filtro
// distorsionaría sus colores de marca).

function LogoLi({ p }: { p: PartnerLogo }) {
  const inner = p.img ? (
    <img src={p.img} alt={p.name} className={`h-8 w-auto ${p.invert ? "invert" : ""}`} />
  ) : (
    <span className="text-ink-3 text-[17px] font-bold tracking-tight whitespace-nowrap">{p.name}</span>
  );
  const hover = p.invert ? "hover:opacity-100" : "hover:opacity-100 hover:grayscale-0";
  return (
    <li className="mx-8 shrink-0">
      {p.href ? (
        <a
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.name}
          title={p.name}
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
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {items.map((p) => (
              <LogoLi key={p.name} p={p} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function Partners({ tone }: { tone: Tone }) {
  return (
    <Section tone={tone} contentClassName="space-y-7 py-10">
      <style>{`
        .miot-marquee { -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .miot-marquee-track { animation: miot-marquee-scroll linear infinite; }
        .miot-marquee:hover .miot-marquee-track { animation-play-state: paused; }
        @keyframes miot-marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .miot-marquee-track { animation: none; } }
      `}</style>
      <Track items={GPS_PARTNERS} duration={80} />
      <Track items={TECH_PARTNERS} reverse duration={36} />
    </Section>
  );
}

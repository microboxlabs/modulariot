import { getTranslations } from "next-intl/server";
import { Section, type Tone } from "./shared";

type Client = { name: string; logo: string; href: string };

// Lista real de clientes — hoy solo Mintral. Cuando haya más de
// MARQUEE_THRESHOLD, la tira pasa a carrusel infinito automáticamente.
const CLIENTS: Client[] = [{ name: "Mintral", logo: "/clients/mintral-logo.png", href: "https://www.mintral.cl/" }];

// Con pocos clientes un carrusel no suma nada — se muestran fijos, sin
// animación. Por encima de este umbral, se repiten y animan en loop.
// TEMPORAL para probar el carrusel con un solo cliente: en 0 (en vez de 3)
// para forzar el modo marquee. Volver a 3 cuando termine la prueba.
const MARQUEE_THRESHOLD = 0;

// Cada mitad de la tira necesita al menos esta cantidad de logos para ser
// más ancha que cualquier viewport realista — si no, la ventana visible
// alcanza el final del contenido antes de completar el ciclo y se ve un
// hueco antes de reiniciar. REPEAT se calcula a partir de CLIENTS.length en
// vez de quedar fijo, para no volver a romperse si se agregan más clientes
// (con 1 cliente hacían falta 24 copias; con más clientes, menos repeticiones
// alcanzan el mismo ancho mínimo).
const MIN_PER_HALF = 12;
const REPEAT = Math.ceil((MIN_PER_HALF * 2) / CLIENTS.length / 2) * 2;

const logoImgCls = "h-9 w-auto shrink-0 opacity-60 grayscale transition-opacity hover:opacity-100 hover:grayscale-0";

// Banda de confianza: título + logos de clientes. Carrusel lento e infinito
// solo cuando hay suficientes; si no, una fila estática.
export async function TrustedBy({ lang, tone }: { lang: string; tone: Tone }) {
  const t = await getTranslations({ locale: lang, namespace: "stats" });
  const useMarquee = CLIENTS.length > MARQUEE_THRESHOLD;
  const strip = useMarquee ? Array.from({ length: REPEAT }, () => CLIENTS).flat() : CLIENTS;

  return (
    <Section tone={tone} contentClassName="pb-10 pt-6">
      <p className="text-center text-xs font-semibold tracking-widest text-ink-3 uppercase">{t("trustedBy")}</p>
      {useMarquee ? (
        <div className="relative mt-6 overflow-hidden mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="logo-marquee flex w-max items-center gap-16">
            {strip.map((c, i) => (
              <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={c.logo} alt={c.name} className={logoImgCls} />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-16">
          {strip.map((c) => (
            <a key={c.name} href={c.href} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src={c.logo} alt={c.name} className={logoImgCls} />
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}

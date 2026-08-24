import { getTranslations } from "next-intl/server";
import type { Block, DetailPageData } from "./DetailPage";

// Config estructural de las páginas de detalle: solo lo que NO es texto
// (icono de página/tarjetas, id de ancla, href/external de links). El texto
// (eyebrow/title/subtitle/kicker/body/bullets/cards/steps/links) vive en
// messages/{es,en,br}.json bajo el namespace "detail", con la misma forma y
// el mismo orden de bloques/arrays que aquí, para poder unirlos por índice.

type CardConfig = { icon?: string; id?: string };
type LinkConfig = { href: string; external?: boolean };

type BlockConfig =
  | { type: "split" }
  | { type: "grid"; id?: string; cards: CardConfig[] }
  | { type: "steps" }
  | { type: "stats" }
  | { type: "linkgrid"; links: LinkConfig[] };

interface PageConfig {
  icon?: string;
  graphic?: string;
  blocks: BlockConfig[];
  // La página ya cuenta el camino evaluación→piloto→operación en su propio
  // bloque de pasos: el CTA final omite sus cifras para no repetirlo.
  ctaStats?: false;
}

export const detailConfig: Record<string, PageConfig> = {
  "producto/ingesta-gps-core": {
    icon: "signal",
    graphic: "ingesta",
    blocks: [{ type: "split" }, { type: "grid", cards: [{ icon: "signal" }, { icon: "bolt" }, { icon: "stack" }, { icon: "shield" }, { icon: "plug" }, { icon: "code" }] }, { type: "steps" }],
  },
  "producto/sintomas-torre-control": {
    icon: "radar",
    graphic: "sintomas",
    blocks: [
      { type: "split" },
      { type: "grid", cards: [{ icon: "radar" }, { icon: "shield" }, { icon: "truck" }, { icon: "signal" }] },
      { type: "steps" },
      { type: "linkgrid", links: [{ href: "/torre" }, { href: "/superprofile" }, { href: "/canales" }] },
    ],
  },
  "producto/integraciones": {
    icon: "plug",
    graphic: "integraciones",
    blocks: [{ type: "split" }, { type: "grid", cards: [{ icon: "plug" }, { icon: "doc" }, { icon: "code" }, { icon: "stack" }, { icon: "bolt" }, { icon: "signal" }] }],
  },
  "producto/video-en-vivo": {
    icon: "video",
    graphic: "video",
    blocks: [{ type: "split" }, { type: "grid", cards: [{ icon: "video" }, { icon: "bolt" }, { icon: "radar" }, { icon: "shield" }] }],
  },
  "producto/caracteristicas": {
    icon: "code",
    blocks: [{ type: "split" }, { type: "grid", cards: [{ icon: "bolt" }, { icon: "radar" }, { icon: "doc" }] }],
  },
  "producto/arquitectura": {
    icon: "stack",
    blocks: [{ type: "steps" }, { type: "stats" }, { type: "grid", cards: [{ icon: "stack" }, { icon: "shield" }, { icon: "plug" }] }],
  },
  "producto/implementacion": {
    icon: "cloud",
    blocks: [{ type: "grid", cards: [{ icon: "cloud" }, { icon: "bolt" }, { icon: "stack" }] }, { type: "steps" }],
    ctaStats: false,
  },
  soluciones: {
    icon: "radar",
    blocks: [
      { type: "grid", id: "casos-de-uso", cards: [{ icon: "truck", id: "monitoreo-conductores" }, { icon: "chart", id: "telemetria-mantenimiento" }, { icon: "shield", id: "cumplimiento-auditorias" }, { icon: "radar", id: "torre-de-control" }] },
      { type: "grid", id: "industrias", cards: [{ icon: "truck", id: "transporte-carga" }, { icon: "stack", id: "mineria" }, { icon: "signal", id: "telemetria-flota" }, { icon: "chart", id: "logistica-industrial" }] },
      { type: "split" },
    ],
  },
  recursos: {
    icon: "doc",
    blocks: [
      { type: "linkgrid", links: [{ href: "https://docs.modulariot.com", external: true }, { href: "/#clientes" }, { href: "/#faq" }] },
      { type: "linkgrid", links: [{ href: "https://github.com/microboxlabs", external: true }, { href: "https://microboxlabs.com", external: true }, { href: "/#contacto" }] },
      { type: "grid", cards: [{ icon: "radar" }, { icon: "chart" }, { icon: "shield" }] },
    ],
  },
};

// Forma del texto traducido (namespace "detail" en los JSON de i18n) — sin
// tipar los campos exactos por tipo de bloque, se casean por bloque abajo.
interface TranslatedBlock {
  kicker?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  cards?: { title: string; body: string }[];
  steps?: { n: string; title: string; body: string }[];
  links?: { title: string; body: string }[];
  items?: { value: string; label: string }[];
}

interface TranslatedPage {
  eyebrow: string;
  title: string;
  subtitle: string;
  blocks: TranslatedBlock[];
}

export function getAllDetailSlugs(): string[] {
  return Object.keys(detailConfig);
}

// Une la config estructural con el texto traducido, por índice de bloque,
// y reconstruye el DetailPageData exacto que DetailPage.tsx ya espera.
export async function getDetailPageData(lang: string, slug: string): Promise<DetailPageData | null> {
  const config = detailConfig[slug];
  if (!config) return null;

  const t = await getTranslations({ locale: lang, namespace: "detail" });
  const text = t.raw(slug) as TranslatedPage;

  const blocks: Block[] = config.blocks.map((bc, i) => {
    const bt = text.blocks[i];
    if (bc.type === "grid") {
      return {
        type: "grid",
        id: bc.id,
        kicker: bt.kicker,
        title: bt.title!,
        subtitle: bt.subtitle,
        cards: bt.cards!.map((c, j) => ({ icon: bc.cards[j]?.icon, id: bc.cards[j]?.id, title: c.title, body: c.body })),
      };
    }
    if (bc.type === "linkgrid") {
      return {
        type: "linkgrid",
        kicker: bt.kicker,
        title: bt.title!,
        subtitle: bt.subtitle,
        links: bt.links!.map((l, j) => ({ title: l.title, body: l.body, href: bc.links[j].href, external: bc.links[j].external })),
      };
    }
    if (bc.type === "steps") {
      return { type: "steps", kicker: bt.kicker, title: bt.title!, subtitle: bt.subtitle, steps: bt.steps! };
    }
    if (bc.type === "stats") {
      return { type: "stats", items: bt.items! };
    }
    return { type: "split", kicker: bt.kicker, title: bt.title!, body: bt.body!, bullets: bt.bullets! };
  });

  return {
    eyebrow: text.eyebrow,
    icon: config.icon,
    graphic: config.graphic,
    title: text.title,
    subtitle: text.subtitle,
    blocks,
    ctaStats: config.ctaStats,
  };
}

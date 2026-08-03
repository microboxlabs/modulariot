import type { Metadata } from "next";

export const LOCALES = ["es", "en", "pt"] as const;
export type Lang = (typeof LOCALES)[number];

const SITE_NAME = "ModularIoT";
const DEFAULT_OG_IMAGE = { url: "/logo.svg", width: 1052, height: 256, alt: SITE_NAME };
const TWITTER_HANDLE = "@microboxlabs";

// Cada página bajo /alpha-2506/{lang} llama a esto para su metadata: fija
// canonical + hreflang (alternates.languages) y repite el bloque completo de
// openGraph/twitter, porque Next.js NO hace merge profundo de esos objetos
// con los del layout — si una página define openGraph, reemplaza el del
// layout entero en vez de solo los campos que toca.
export function pageMetadata({
  lang,
  path = "",
  title,
  description,
}: {
  lang: Lang;
  path?: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = `/alpha-2506/${lang}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/alpha-2506/${l}${path}`])),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
      creator: TWITTER_HANDLE,
    },
  };
}

const SITE_URL = "https://modulariot.com";

// Organization + WebSite JSON-LD, idéntico en todas las páginas (identidad de
// marca, no varía por ruta). Se serializa una sola vez en el layout de [lang].
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.svg`,
        sameAs: ["https://github.com/microboxlabs", "https://x.com/microboxlabs"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}#organization` },
      },
    ],
  };
}

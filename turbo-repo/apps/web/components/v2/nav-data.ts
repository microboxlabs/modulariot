// Estructura no-textual del nav (íconos, hrefs, flags de idioma), alineada
// por índice con el namespace "nav" de messages/{es,en,br}.json. Mismo split
// que CARD_IDS en UseCases.tsx: el texto vive en el JSON, lo que no es texto
// (ids/hrefs) queda en código.

export const MEGA_SECTIONS: { items: { icon: string; href: string }[] }[] = [
  {
    items: [
      { icon: "signal", href: "/producto/ingesta-gps-core" },
      { icon: "radar", href: "/producto/sintomas-torre-control" },
      { icon: "plug", href: "/producto/integraciones" },
      { icon: "video", href: "/producto/video-en-vivo" },
    ],
  },
  {
    items: [
      { icon: "code", href: "/producto/caracteristicas" },
      { icon: "stack", href: "/producto/arquitectura" },
      { icon: "cloud", href: "/producto/implementacion" },
    ],
  },
  {
    items: [
      { icon: "radar", href: "/torre" },
      { icon: "stack", href: "/superprofile" },
      { icon: "plug", href: "/canales" },
      { icon: "signal", href: "/proveedores-gps" },
    ],
  },
];

export const COLUMN_MENUS: {
  columns: { links: { href: string; external?: boolean }[]; footer?: { href: string } }[];
}[] = [
  {
    columns: [
      {
        links: [
          { href: "/soluciones#casos-de-uso" },
          { href: "/soluciones#casos-de-uso" },
          { href: "/soluciones#casos-de-uso" },
          { href: "/soluciones#casos-de-uso" },
        ],
        footer: { href: "/soluciones" },
      },
      {
        links: [
          { href: "/soluciones#industrias" },
          { href: "/soluciones#industrias" },
          { href: "/soluciones#industrias" },
          { href: "/soluciones#industrias" },
        ],
        footer: { href: "/#clientes" },
      },
    ],
  },
  {
    columns: [
      {
        links: [{ href: "https://docs.modulariot.com", external: true }, { href: "/#faq" }],
        footer: { href: "/recursos" },
      },
      {
        links: [
          { href: "https://github.com/microboxlabs", external: true },
          { href: "https://microboxlabs.com", external: true },
        ],
      },
    ],
  },
];

export const DIRECT_LINKS: { href: string; external?: boolean }[] = [{ href: "/contacto" }];

export const GITHUB_HREF = "https://github.com/microboxlabs";

// Selector de país → idioma. `flag` = código de bandera SVG en flags.tsx.
export const LANGUAGE_CODES: { lang: string; flag: string }[] = [
  { lang: "es", flag: "cl" },
  { lang: "es", flag: "pe" },
  { lang: "es", flag: "co" },
  { lang: "es", flag: "mx" },
  { lang: "pt", flag: "br" },
  { lang: "en", flag: "gl" },
];

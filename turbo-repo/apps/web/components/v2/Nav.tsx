"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { getContent } from "./content";

// Los hrefs del contenido son relativos a la home ("/#seccion", "/precios");
// se prefijan con /alpha-2506/{lang} según la ruta actual.
export function useBasePath() {
  const pathname = usePathname() || "/alpha-2506/es";
  const parts = pathname.split("/").filter(Boolean);
  return { base: `/${parts[0] || "alpha-2506"}/${parts[1] || "es"}`, lang: parts[1] || "es" };
}

function resolveHref(base: string, href: string) {
  return href.startsWith("http") || href.startsWith("mailto:") ? href : `${base}${href}`;
}

const navIcons: Record<string, React.ReactNode> = {
  signal: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
  ),
  radar: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  ),
  plug: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  ),
  video: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
  ),
  code: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
  ),
  stack: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
  ),
  cloud: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
  ),
};

function ExternalIcon() {
  return (
    <svg className="h-3 w-3 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="h-3 w-3 text-gray-500 transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// Panel animado estilo ClickHouse: scale-95 + opacity-0 → visible en hover del grupo.
const panelBase =
  "pointer-events-none absolute top-full z-50 origin-top-left scale-95 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100";

const topItem =
  "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5 hover:text-white";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { base, lang } = useBasePath();
  const nav = getContent(lang).nav;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-gray-950/85 backdrop-blur transition-colors">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        {/* Logo */}
        <a href={`${base}/`} className="mr-4 flex shrink-0 items-center gap-2">
          <img src="/headlogo-dark.svg" alt="ModularIoT" className="h-7 w-auto" />
          <span className="text-lg font-bold tracking-tight text-white">
            Modular<span className="text-yellow-400">IoT</span>
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden flex-1 items-center lg:flex">
          {/* Producto: mega-menú con items ricos en secciones */}
          <div className="group relative">
            <button className={topItem}>
              {nav.mega.label}
              <Chevron />
            </button>
            <div className={`${panelBase} left-0 ${nav.mega.sections.length >= 3 ? "w-[900px]" : "w-[720px]"}`}>
              <div className={`grid ${nav.mega.sections.length >= 3 ? "grid-cols-3" : "grid-cols-2"} rounded-xl bg-[#1b1b1e] p-5 shadow-2xl ring-1 ring-white/10`}>
                {nav.mega.sections.map((section, si) => (
                  <div key={section.title} className={si === 0 ? "pr-6" : "border-l border-white/10 px-6"}>
                    <p className="mb-2 px-2 text-sm font-semibold text-white">{section.title}</p>
                    {section.items.map((item) => (
                      <a
                        key={item.label}
                        href={resolveHref(base, item.href)}
                        className="group/item flex items-start gap-3.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-blue-400 transition-colors group-hover/item:bg-blue-400/10">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            {navIcons[item.icon]}
                          </svg>
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-white">{item.label}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-gray-400">{item.desc}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Soluciones / Recursos: columnas con encabezado */}
          {nav.columnMenus.map((menu) => (
            <div key={menu.label} className="group relative">
              <button className={topItem}>
                {menu.label}
                <Chevron />
              </button>
              <div className={`${panelBase} left-0 w-[520px]`}>
                <div className="grid grid-cols-2 rounded-xl bg-[#1b1b1e] p-5 shadow-2xl ring-1 ring-white/10">
                  {menu.columns.map((col, ci) => (
                    <div key={col.title} className={`flex flex-col ${ci === 1 ? "border-l border-white/10 pl-6" : "pr-6"}`}>
                      <p className="mb-2 px-2 text-sm font-semibold text-white">{col.title}</p>
                      {col.links.map((link) => (
                        <a
                          key={link.label}
                          href={resolveHref(base, link.href)}
                          {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-[15px] text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          {link.label}
                          {"external" in link && link.external && <ExternalIcon />}
                        </a>
                      ))}
                      {"footer" in col && col.footer && (
                        <a
                          href={resolveHref(base, col.footer.href)}
                          className="mt-2 border-t border-white/10 px-2 pt-3 text-[15px] font-medium text-blue-400 transition-colors hover:text-blue-300"
                        >
                          {col.footer.label}
                          <svg className="ml-1.5 inline h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 12h15m0 0l-6-6m6 6l-6 6" />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Links directos */}
          {nav.direct.map((item) => (
            <a
              key={item.label}
              href={resolveHref(base, item.href)}
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={topItem}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Derecha: GitHub badge + idioma + CTA */}
        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <a
            href={nav.github.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </a>

          {/* Selector de idioma (region selector de ClickHouse) */}
          <div className="group relative">
            <button className={topItem} aria-label="Cambiar idioma">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <span className="uppercase">{lang}</span>
              <Chevron />
            </button>
            <div className={`${panelBase} right-0 w-40 origin-top-right`}>
              <div className="rounded-xl border border-white/10 bg-gray-900 p-2 shadow-2xl">
                {nav.languages.map((l) => (
                  <a
                    key={l.code}
                    href={`/alpha-2506/${l.code}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                      l.code === lang ? "font-semibold text-blue-400" : "text-gray-200"
                    }`}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <a
            href={resolveHref(base, "/contacto?intent=demo")}
            className="ml-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {nav.cta}
          </a>
        </div>

        {/* Mobile: hamburguesa */}
        <button
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-gray-200 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menú"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile: acordeón oscuro */}
      {open && (
        <div className="max-h-[80vh] overflow-y-auto border-t border-white/5 bg-gray-950 px-4 pb-4 lg:hidden">
          {[
            { label: nav.mega.label, links: nav.mega.sections.flatMap((s) => s.items.map((i) => ({ label: i.label, href: i.href }))) },
            ...nav.columnMenus.map((m) => ({
              label: m.label,
              links: m.columns.flatMap((c) => c.links.map((l) => ({ label: l.label, href: l.href }))),
            })),
          ].map((group) => (
            <div key={group.label} className="border-b border-white/5">
              <button
                onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                className="flex w-full items-center justify-between py-3 text-sm font-semibold text-white"
              >
                {group.label}
                <svg className="h-5 w-5 shrink-0 text-gray-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 10h12" />
                  {openGroup !== group.label && <path d="M10 4v12" />}
                </svg>
              </button>
              {openGroup === group.label && (
                <div className="pb-2">
                  {group.links.map((link) => (
                    <a
                      key={link.label}
                      href={resolveHref(base, link.href)}
                      onClick={() => setOpen(false)}
                      className="block py-2 pl-4 text-sm text-gray-300"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {nav.direct.map((item) => (
            <a
              key={item.label}
              href={resolveHref(base, item.href)}
              onClick={() => setOpen(false)}
              className="block border-b border-white/5 py-3 text-sm font-semibold text-white"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 flex items-center gap-3">
            {nav.languages.map((l) => (
              <a
                key={l.code}
                href={`/alpha-2506/${l.code}`}
                className={`text-sm uppercase ${l.code === lang ? "font-bold text-blue-400" : "text-gray-400"}`}
              >
                {l.code}
              </a>
            ))}
          </div>
          <a
            href={resolveHref(base, "/contacto?intent=demo")}
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            {nav.cta}
          </a>
        </div>
      )}
    </header>
  );
}

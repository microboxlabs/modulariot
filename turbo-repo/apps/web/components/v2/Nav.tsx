"use client";

import { useState, useEffect } from "react";
import { DarkThemeToggle } from "flowbite-react";
import { getContent } from "./content";
import { Flag } from "./flags";
import { LynxBrand } from "@modulariot/ui/brand/logo";

const COUNTRY_KEY = "miot_country";

// Toggle de tema con la piel del DS (mismo trato que .gh-btn del header).
const themeToggleStyle = {
  root: {
    base: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1 focus:outline-none focus:ring-0",
  },
};

// Abreviatura compacta para el botón colapsado (el dropdown usa nombre completo).
const ABBR: Record<string, string> = {
  cl: "CL",
  pe: "PE",
  co: "CO",
  mx: "MX",
  br: "BR",
  gl: "INT",
};

function resolveHref(base: string, href: string) {
  return href.startsWith("http") || href.startsWith("mailto:")
    ? href
    : `${base}${href}`;
}

const navIcons: Record<string, React.ReactNode> = {
  signal: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z"
    />
  ),
  radar: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
    />
  ),
  plug: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
    />
  ),
  video: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
    />
  ),
  code: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
    />
  ),
  stack: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
    />
  ),
  cloud: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
    />
  ),
};

function ExternalIcon() {
  return (
    <svg
      className="text-ink-4 h-3 w-3 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      className="text-ink-4 h-3 w-3 transition-transform duration-200 group-hover:rotate-180"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

// Panel flotante: superficie del DS con hairline y sombra; scale+fade al hover.
// Base sin position (absolute y fixed no pueden mezclarse en un mismo string:
// ambos tocan la misma propiedad CSS y gana el orden interno de Tailwind, no
// el orden del className). Cada trigger elige su propia variante de anclaje.
const panelBase =
  "pointer-events-none z-50 scale-95 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100";
// Anclado a la izquierda del propio botón — para paneles angostos que nunca se desbordan.
const panelAnchored = `${panelBase} absolute left-0 top-full origin-top-left`;
// Centrado en el viewport — para el panel ancho de Producto, que se desbordaría anclado al botón.
const panelCentered = `${panelBase} fixed inset-x-0 top-[60px] mx-auto origin-top`;
const panelCard = "rounded-xl border border-hairline bg-surface shadow-xl";

const topItem =
  "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1";

export default function Nav({ lang }: { lang: string }) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const base = `/alpha-2506/${lang}`;
  const nav = getContent(lang).nav;

  // País elegido persistido; se lee tras montar (evita mismatch SSR).
  useEffect(() => {
    try {
      setCountry(localStorage.getItem(COUNTRY_KEY));
    } catch {}
  }, []);

  // País activo: el guardado si coincide con el idioma de la ruta, si no el
  // primer país (ancla) de ese idioma.
  const regions = nav.languages;
  const activeRegion =
    regions.find((r) => r.flag === country && r.lang === lang) ||
    regions.find((r) => r.lang === lang) ||
    regions[0];
  const pickRegion = (flag: string) => {
    try {
      localStorage.setItem(COUNTRY_KEY, flag);
    } catch {}
  };

  return (
    <header className="border-hairline bg-page/85 sticky top-0 z-50 w-full border-b backdrop-blur-md">
      <nav className="mx-auto flex h-[60px] max-w-7xl items-center gap-2 px-6">
        {/* Marca: componente compartido (ícono + wordmark independientes) */}
        <a
          href={`${base}/`}
          className="text-brand-ink mr-4"
          aria-label="ModularIoT"
        >
          <LynxBrand iconClassName="h-11 w-11" wordmarkClassName="h-5 w-auto" />
        </a>

        {/* Desktop */}
        <div className="hidden flex-1 items-center lg:flex">
          {/* Producto: mega-menú con items ricos en secciones. Centrado en el
              viewport (no anclado al botón) porque es demasiado ancho para
              quedar pegado a la izquierda sin desbordar. El wrapper mide el
              alto completo de la barra (no solo el botón) para que no quede
              una franja muerta que corte el hover al bajar el mouse. */}
          <div className="group flex h-[60px] items-center">
            <button className={topItem}>
              {nav.mega.label}
              <Chevron />
            </button>
            <div
              className={`${panelCentered} w-[92vw] ${nav.mega.sections.length >= 3 ? "max-w-7xl" : "max-w-3xl"}`}
            >
              <div
                className={`grid ${nav.mega.sections.length >= 3 ? "grid-cols-3" : "grid-cols-2"} ${panelCard} p-6`}
              >
                {nav.mega.sections.map((section, si) => (
                  <div
                    key={section.title}
                    className={
                      si === 0 ? "pr-6" : "border-hairline border-l px-6"
                    }
                  >
                    <p className="text-ink-3 mb-3 px-2 text-xs font-semibold tracking-[0.08em] uppercase">
                      {section.title}
                    </p>
                    {section.items.map((item) => (
                      <a
                        key={item.label}
                        href={resolveHref(base, item.href)}
                        className="group/item hover:bg-surface-3 flex items-start gap-3.5 rounded-lg px-2 py-3 transition-colors"
                      >
                        <span className="bg-accent-soft text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            {navIcons[item.icon]}
                          </svg>
                        </span>
                        <span>
                          <span className="text-ink-1 block text-[15px] font-semibold">
                            {item.label}
                          </span>
                          <span className="text-ink-3 mt-0.5 block text-[13px] leading-snug">
                            {item.desc}
                          </span>
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
              <div className={`${panelAnchored} w-[520px]`}>
                <div className={`grid grid-cols-2 ${panelCard} p-5`}>
                  {menu.columns.map((col, ci) => (
                    <div
                      key={col.title}
                      className={`flex flex-col ${ci === 1 ? "border-hairline border-l pl-6" : "pr-6"}`}
                    >
                      <p className="text-ink-3 mb-2 px-2 text-xs font-semibold tracking-[0.08em] uppercase">
                        {col.title}
                      </p>
                      {col.links.map((link) => (
                        <a
                          key={link.label}
                          href={resolveHref(base, link.href)}
                          {...("external" in link && link.external
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                          className="text-ink-2 hover:bg-surface-3 hover:text-ink-1 flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors"
                        >
                          {link.label}
                          {"external" in link && link.external && (
                            <ExternalIcon />
                          )}
                        </a>
                      ))}
                      {"footer" in col && col.footer && (
                        <a
                          href={resolveHref(base, col.footer.href)}
                          className="border-hairline text-accent hover:text-accent-strong mt-2 border-t px-2 pt-3 text-sm font-medium transition-colors"
                        >
                          {col.footer.label}
                          <svg
                            className="ml-1.5 inline h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
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
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className={topItem}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Derecha: GitHub + tema + idioma + acciones */}
        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <a
            href={nav.github.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="border-hairline bg-surface text-ink-2 hover:bg-surface-3 hover:text-ink-1 flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>

          <DarkThemeToggle theme={themeToggleStyle} />

          <a
            href={resolveHref(base, nav.actions.login.href)}
            className="text-ink-2 hover:text-ink-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            {nav.actions.login.label}
          </a>
          <a
            href={resolveHref(base, nav.actions.signup.href)}
            className="border-ink-1 bg-ink-1 text-page hover:bg-ink-2 hover:border-ink-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
          >
            {nav.actions.signup.label}
          </a>
        </div>

        {/* Mobile: toggle de tema + hamburguesa */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <DarkThemeToggle theme={themeToggleStyle} />
          <button
            className="text-ink-2 flex h-10 w-10 items-center justify-center rounded-lg"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile: acordeón sobre superficie */}
      {open && (
        <div className="border-hairline bg-page max-h-[80vh] overflow-y-auto border-t px-6 pb-6 lg:hidden">
          {[
            {
              label: nav.mega.label,
              links: nav.mega.sections.flatMap((s) =>
                s.items.map((i) => ({ label: i.label, href: i.href })),
              ),
            },
            ...nav.columnMenus.map((m) => ({
              label: m.label,
              links: m.columns.flatMap((c) =>
                c.links.map((l) => ({ label: l.label, href: l.href })),
              ),
            })),
          ].map((group) => (
            <div key={group.label} className="border-hairline border-b">
              <button
                onClick={() =>
                  setOpenGroup(openGroup === group.label ? null : group.label)
                }
                className="text-ink-1 flex w-full items-center justify-between py-3 text-sm font-semibold"
              >
                {group.label}
                <svg
                  className="text-ink-4 h-5 w-5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
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
                      className="text-ink-2 block py-2 pl-4 text-sm"
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
              className="border-hairline text-ink-1 block border-b py-3 text-sm font-semibold"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-4 space-y-2">
            <a
              href={resolveHref(base, nav.actions.login.href)}
              onClick={() => setOpen(false)}
              className="text-ink-2 block rounded-lg px-4 py-2.5 text-center text-sm font-medium"
            >
              {nav.actions.login.label}
            </a>
            <a
              href={resolveHref(base, nav.actions.signup.href)}
              onClick={() => setOpen(false)}
              className="border-ink-1 bg-ink-1 text-page block rounded-lg border px-4 py-2.5 text-center text-sm font-medium"
            >
              {nav.actions.signup.label}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

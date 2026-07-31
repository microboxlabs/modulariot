import { getContent } from "../content";
import { LynxBrand } from "../brand/Logo";

export function Footer({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).footer;
  return (
    <footer className="border-t border-hairline bg-page">
      <div className="mx-auto max-w-7xl px-6 pt-14 pb-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <a href={`${base}/`} className="inline-flex text-brand-ink" aria-label="ModularIoT">
              <LynxBrand iconClassName="h-11 w-11" wordmarkClassName="h-5 w-auto" />
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-3">{c.description}</p>
          </div>
          {c.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-1 uppercase">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href.startsWith("http") || link.href.startsWith("mailto:") ? link.href : `${base}${link.href}`}
                      className="text-sm text-ink-3 transition-colors hover:text-ink-1"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 border-t border-hairline pt-6 text-xs text-ink-4">{c.copyright}</p>
      </div>
    </footer>
  );
}

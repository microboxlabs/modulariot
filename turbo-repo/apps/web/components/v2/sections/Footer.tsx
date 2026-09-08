import { getTranslations } from "next-intl/server";
import { getContent } from "../content";
import { LynxBrand } from "@modulariot/ui/brand/logo";

export async function Footer({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).footer;
  const t = await getTranslations({ locale: lang, namespace: "legalLinks" });
  return (
    <footer className="border-hairline bg-page border-t">
      <div className="mx-auto max-w-7xl px-6 pt-14 pb-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <a
              href={`${base}/`}
              className="text-brand-ink inline-flex"
              aria-label="ModularIoT"
            >
              <LynxBrand
                iconClassName="h-11 w-11"
                wordmarkClassName="h-5 w-auto"
              />
            </a>
            <p className="text-ink-3 mt-4 max-w-sm text-sm leading-relaxed">
              {c.description}
            </p>
          </div>
          {c.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-ink-1 text-xs font-semibold tracking-[0.08em] uppercase">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={
                        link.href.startsWith("http") ||
                        link.href.startsWith("mailto:")
                          ? link.href
                          : `${base}${link.href}`
                      }
                      className="text-ink-3 hover:text-ink-1 text-sm transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-ink-2 mt-8 flex gap-6 text-sm">
          <a href="/privacy" className="hover:text-accent">
            {t("privacy")}
          </a>
          <a href="/terms" className="hover:text-accent">
            {t("terms")}
          </a>
        </div>
        <p className="border-hairline text-ink-4 mt-12 border-t pt-6 text-xs">
          {c.copyright}
        </p>
      </div>
    </footer>
  );
}

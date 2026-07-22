import { getContent } from "../content";

export function Footer({ base, lang }: { base: string; lang: string }) {
  const c = getContent(lang).footer;
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 pb-6 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <img src="/headlogo-dark.svg" alt="ModularIoT" className="h-6 w-auto" />
              <span className="font-bold text-white">
                Modular<span className="text-yellow-400">IoT</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">{c.description}</p>
          </div>
          {c.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href.startsWith("http") || link.href.startsWith("mailto:") ? link.href : `${base}${link.href}`}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 border-t border-gray-800 pt-6 text-xs text-gray-500">{c.copyright}</p>
      </div>
    </footer>
  );
}

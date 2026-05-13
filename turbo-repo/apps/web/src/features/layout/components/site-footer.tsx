import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

const COLUMNS: { title: string; links: string[] }[] = [
  {
    title: "Product",
    links: ["Features", "Architecture", "Symptom model", "Roadmap", "Changelog"],
  },
  {
    title: "Developers",
    links: ["Documentation", "API reference", "GitHub", "Examples", "Status"],
  },
  {
    title: "Company",
    links: ["About MicroboxLabs", "Customers", "Blog", "Press", "Careers"],
  },
  {
    title: "Resources",
    links: ["Architecture guide", "Security", "Privacy", "Terms", "Contact"],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface-1 pt-16 pb-8 text-ink-3 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-3.5 lg:col-span-1">
            <Link
              href="/"
              aria-label="modulariot — home"
              className="inline-flex items-center"
            >
              <Image
                src="/brand/logo-modulariot.svg"
                alt="modulariot"
                width={148}
                height={36}
                className="h-8 w-auto dark:brightness-0 dark:invert"
              />
            </Link>
            <p className="max-w-[280px] text-[13.5px] leading-[1.6] text-ink-3 dark:text-gray-400">
              Real-time operational intelligence. Open-source. Yours to run.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="modulariot on GitHub"
              className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 py-1 text-[12px] font-medium text-ink-1 transition-colors hover:bg-surface-3 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
            >
              <FaGithub aria-hidden className="size-3.5" />
              <span>2.4k</span>
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-1 dark:text-gray-50">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((label) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="text-[13.5px] text-ink-3 transition-colors hover:text-ink-1 dark:text-gray-400 dark:hover:text-gray-50"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex items-center justify-between border-t border-hairline pt-6 text-[12px] dark:border-gray-800">
          <span>© {new Date().getFullYear()} MicroboxLabs · Apache-2.0</span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-action"
              style={{ animation: "live-pulse 2s ease-out infinite" }}
              aria-hidden
            />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";
const ISSUES_URL = `${REPO_URL}/issues`;
const DISCUSSIONS_URL = `${REPO_URL}/discussions`;
const ROADMAP_URL = `${REPO_URL}/projects`;

type Column = { title: string; links: { label: string; href: string }[] };

const COLUMNS: Column[] = [
  {
    title: "Product",
    links: [
      { label: "Symptom Intelligence", href: "#symptoms" },
      { label: "Primitives", href: "#product" },
      { label: "Architecture", href: "#architecture" },
      { label: "Dashboards", href: "#dashboards" },
      { label: "Compatibility", href: "#compatibility" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Quick start", href: "#quickstart" },
      { label: "Examples", href: "#examples" },
      { label: "GitHub", href: REPO_URL },
      { label: "Issues", href: ISSUES_URL },
      { label: "API reference", href: "#docs" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Open source", href: "#open-source" },
      { label: "Discussions", href: DISCUSSIONS_URL },
      { label: "Roadmap", href: ROADMAP_URL },
      { label: "Blog", href: "#blog" },
      { label: "Contributing", href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "Status", href: "#status" },
      { label: "Security", href: "#security" },
      { label: "License (MIT)", href: `${REPO_URL}/blob/main/LICENSE` },
      { label: "Privacy", href: "#privacy" },
    ],
  },
];

function isExternal(href: string) {
  return href.startsWith("http");
}

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <Link
              href="/"
              aria-label="Modular IoT — home"
              className="inline-flex items-center gap-2"
            >
              <Image
                src="/brand/logo.svg"
                alt="Modular IoT"
                width={32}
                height={32}
                className="size-8"
              />
              <span className="text-base font-semibold tracking-tight">
                Modular IoT
              </span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Open-source real-time monitoring, built around symptoms.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Modular IoT on GitHub"
              className="mt-2 inline-flex w-fit items-center gap-2 text-sm text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <FaGithub aria-hidden className="size-4" />
              microboxlabs/modulariot
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.href}`}>
                    {isExternal(link.href) ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-gray-700 transition-colors hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-gray-700 transition-colors hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-200 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center dark:border-gray-800 dark:text-gray-400">
          <span>
            © {new Date().getFullYear()} Modular IoT. MIT-licensed.
            Self-hosted. Your data, your cloud.
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Modular IoT on GitHub"
            className="transition-colors hover:text-gray-900 dark:hover:text-white"
          >
            <FaGithub aria-hidden className="size-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

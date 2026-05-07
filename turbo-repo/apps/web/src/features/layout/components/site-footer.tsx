import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

type Column = { title: string; links: { label: string; href: string }[] };

const COLUMNS: Column[] = [
  {
    title: "Product",
    links: [
      { label: "Symptom Intelligence", href: "#symptoms" },
      { label: "Architecture", href: "#architecture" },
      { label: "Dashboards", href: "#dashboards" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Quick start", href: "#quickstart" },
      { label: "API reference", href: "#api" },
      { label: "Examples", href: "#examples" },
      { label: "GitHub", href: REPO_URL },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Blog", href: "#blog" },
      { label: "Contact", href: "#contact" },
      { label: "Careers", href: "#careers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "Open source", href: "#open-source" },
      { label: "Status", href: "#status" },
      { label: "Security", href: "#security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-700 transition-colors hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/logo.svg"
              alt="Modular IoT"
              width={28}
              height={28}
              className="size-7"
            />
            <span className="text-sm text-gray-500">
              © {new Date().getFullYear()} Modular IoT. Open-source real-time monitoring.
            </span>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Modular IoT on GitHub"
            className="text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
          >
            <FaGithub aria-hidden className="size-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

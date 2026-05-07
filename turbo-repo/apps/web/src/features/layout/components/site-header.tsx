import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const REPO_URL = "https://github.com/microboxlabs/modulariot";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Architecture", href: "#architecture" },
  { label: "Open source", href: "#open-source" },
  { label: "Docs", href: "#docs" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Modular IoT — home"
          className="flex items-center gap-2"
        >
          <Image
            src="/brand/headlogo.svg"
            alt="Modular IoT"
            width={140}
            height={28}
            priority
            className="dark:hidden"
          />
          <Image
            src="/brand/headlogo-dark.svg"
            alt="Modular IoT"
            width={140}
            height={28}
            priority
            className="hidden dark:block"
          />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
        >
          <FaGithub aria-hidden className="size-4" />
          <span>Star on GitHub</span>
        </a>
      </div>
    </header>
  );
}

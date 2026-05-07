import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { GitHubStarBadge } from "./github-star-badge";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#symptom" },
  { label: "Showcase", href: "#showcase" },
  { label: "Quick start", href: "#quickstart" },
  { label: "Community", href: "#community" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface-1/85 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-8 px-6">
        <Link
          href="/"
          aria-label="modulariot — home"
          className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-ink-1 dark:text-gray-50"
        >
          <BrandMark />
          modulariot
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <GitHubStarBadge />
        </div>
      </div>
    </header>
  );
}

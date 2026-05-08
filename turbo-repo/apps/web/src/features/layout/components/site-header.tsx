import Image from "next/image";
import Link from "next/link";
import { GitHubStarBadge } from "./github-star-badge";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";

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
          className="inline-flex items-center"
        >
          {/* Real platform lockup. Navy fill works on light surfaces; dark
              mode applies brightness-0 + invert to render it as white. */}
          <Image
            src="/brand/logo-modulariot.svg"
            alt="modulariot"
            width={132}
            height={32}
            priority
            className="h-7 w-auto dark:brightness-0 dark:invert"
          />
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
          <LangToggle />
          <ThemeToggle />
          <GitHubStarBadge />
          <Link
            href="#final"
            className="hidden h-[34px] items-center rounded-md border border-ink-1 bg-ink-1 px-3.5 text-[13px] font-medium leading-none text-surface-1 transition-colors hover:bg-ink-2 hover:border-ink-2 sm:inline-flex dark:border-gray-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Book a 20-min demo
          </Link>
        </div>
      </div>
    </header>
  );
}

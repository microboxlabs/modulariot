import Link from "next/link";
import { LynxMark } from "@modulariot/ui/brand/logo";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  activeLink: "terms" | "privacy";
  children: React.ReactNode;
};

export function LegalPageLayout({
  title,
  lastUpdated,
  activeLink,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-12">
          <Link
            href="/"
            className="text-ink-3 hover:text-ink-1 inline-flex items-center space-x-2 transition-colors duration-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Home</span>
          </Link>
          <div className="mt-8 flex items-center space-x-4">
            <span className="text-brand-ink">
              <LynxMark className="h-12 w-12" />
            </span>
            <h1 className="text-ink-1 text-3xl font-bold sm:text-4xl">
              {title}
            </h1>
          </div>
          <p className="text-ink-3 mt-2">Last updated: {lastUpdated}</p>
        </header>

        {/* Content */}
        <article className="prose prose-lg dark:prose-invert max-w-none">
          {children}
        </article>

        {/* Footer */}
        <footer className="border-hairline mt-16 border-t pt-8">
          <div className="text-ink-3 flex flex-col items-center justify-between text-sm sm:flex-row">
            <p>&copy; 2026 MicroboxLabs. All rights reserved.</p>
            <div className="mt-4 flex space-x-6 sm:mt-0">
              <Link href="/" className="hover:text-ink-1 transition-colors">
                Home
              </Link>
              <Link
                href="/privacy"
                className={
                  activeLink === "privacy"
                    ? "text-accent"
                    : "hover:text-ink-1 transition-colors"
                }
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className={
                  activeLink === "terms"
                    ? "text-accent"
                    : "hover:text-ink-1 transition-colors"
                }
              >
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

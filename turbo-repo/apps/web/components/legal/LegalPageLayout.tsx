import { ThemeModeScript } from "flowbite-react";
import { Inter } from "next/font/google";
import "../../app/globals.css";
import Link from "next/link";
import { LynxMark } from "../v2/brand/Logo";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  activeLink: "terms" | "privacy";
  children: React.ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, activeLink, children }: LegalPageLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased">
        <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-12">
              <Link href="/" className="inline-flex items-center space-x-2 text-ink-3 hover:text-ink-1 transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </Link>
              <div className="mt-8 flex items-center space-x-4">
                <span className="text-brand-ink">
                  <LynxMark className="h-12 w-12" />
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-ink-1">{title}</h1>
              </div>
              <p className="mt-2 text-ink-3">Last updated: {lastUpdated}</p>
            </header>

            {/* Content */}
            <article className="prose prose-lg dark:prose-invert max-w-none">{children}</article>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-hairline">
              <div className="flex flex-col sm:flex-row items-center justify-between text-ink-3 text-sm">
                <p>&copy; 2025 MicroboxLabs. All rights reserved.</p>
                <div className="mt-4 sm:mt-0 flex space-x-6">
                  <Link href="/" className="hover:text-ink-1 transition-colors">Home</Link>
                  <Link href="/privacy" className={activeLink === "privacy" ? "text-accent" : "hover:text-ink-1 transition-colors"}>Privacy</Link>
                  <Link href="/terms" className={activeLink === "terms" ? "text-accent" : "hover:text-ink-1 transition-colors"}>Terms</Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}

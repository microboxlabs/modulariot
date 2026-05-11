import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { ThemeModeScript } from "flowbite-react";
import { ThemeInit } from "../../.flowbite-react/init";
import ThemeDetector from "@/features/theme/components/ThemeDetector";
import { PromoRibbon } from "@/features/layout/components/promo-ribbon";
import { SiteHeader } from "@/features/layout/components/site-header";
import { SiteFooter } from "@/features/layout/components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// DM Sans is the design's display face for marketing numerals (counters at 100px)
// and the marquee tenant labels. Only used where `font-display` is set.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Modular IoT — Open-source real-time monitoring",
  description:
    "Modular IoT is an open-source platform that turns telemetry into operational symptoms, and symptoms into action.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${dmSans.variable}`}
    >
      <head>
        <ThemeModeScript />
      </head>
      <body className="bg-white font-sans text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-50">
        <ThemeInit />
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        >
          Skip to content
        </a>
        <ThemeDetector>
          <div className="flex min-h-screen flex-col">
            <PromoRibbon />
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </ThemeDetector>
      </body>
    </html>
  );
}

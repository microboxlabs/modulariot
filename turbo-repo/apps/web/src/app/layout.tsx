import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeModeScript } from "flowbite-react";
import { ThemeInit } from "../../.flowbite-react/init";
import ThemeDetector from "@/features/theme/components/ThemeDetector";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
      </head>
      <body className="bg-white font-sans text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-50">
        <ThemeInit />
        <ThemeDetector>{children}</ThemeDetector>
      </body>
    </html>
  );
}

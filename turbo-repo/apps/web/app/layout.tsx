import type { Metadata, Viewport } from "next";
import { ThemeModeScript } from "flowbite-react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ModularIoT — De detectar desviaciones a reducirlas",
  description:
    "Convertimos cada señal de tu flota en menos desviaciones repetidas. Los datos y las decisiones son tuyos.",
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
      </head>
      <body className="bg-page text-ink-1 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

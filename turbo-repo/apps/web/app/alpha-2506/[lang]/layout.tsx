import type { Metadata } from "next";
import { ThemeModeScript } from "flowbite-react";
import { NextIntlClientProvider } from "next-intl";
import { Inter } from "next/font/google";
import "../../globals.css";
import Nav from "../../../components/v2/Nav";
import DemoFab from "../../../components/v2/DemoFab";
import { Footer } from "../../../components/v2/sections/Footer";
import { getMessages } from "../../../i18n/request";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://modulariot.com"),
  title: "ModularIoT — De detectar desviaciones a reducirlas",
  description:
    "Plataforma de monitoreo operacional en tiempo real. Convertimos cada señal de tu flota en menos desviaciones repetidas. Código abierto, sin dependencia de proveedores.",
  keywords: ["fleet management", "IoT", "real-time data", "streaming", "telematics", "GPS tracking", "sensor data", "open source", "Apache-2.0"],
  authors: [{ name: "MicroboxLabs" }],
  creator: "MicroboxLabs",
  publisher: "MicroboxLabs",
  openGraph: {
    title: "ModularIoT — De detectar desviaciones a reducirlas",
    description:
      "Plataforma open-source de monitoreo operacional en tiempo real: cada ping GPS, valor de sensor y evento del conductor fluye por tu nube en milisegundos.",
    url: "https://modulariot.com",
    siteName: "ModularIoT",
    type: "website",
    images: [{ url: "/logo.svg", width: 1052, height: 256, alt: "ModularIoT" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ModularIoT — De detectar desviaciones a reducirlas",
    description:
      "Plataforma open-source de monitoreo operacional en tiempo real para datos de flota.",
    images: ["/logo.svg"],
    creator: "@microboxlabs",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }, { lang: "pt" }];
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  const messages = getMessages(lang);
  const base = `/alpha-2506/${lang}`;

  return (
    <html lang={lang} suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <link rel="canonical" href="https://modulariot.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-page font-sans text-ink-1 antialiased">
        <NextIntlClientProvider locale={lang} messages={messages}>
          {/* Cascarón compartido: Nav fijo arriba, todo lo demás (contenido de
              página + Footer) vive en el único panel que hace scroll. */}
          <div className="flex h-dvh flex-col overflow-hidden">
            <Nav />
            <div className="flex-1 overflow-y-auto">
              {children}
              <Footer base={base} lang={lang} />
            </div>
          </div>
        </NextIntlClientProvider>
        <DemoFab lang={lang} />
      </body>
    </html>
  );
}

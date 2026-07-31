import type { Metadata } from "next";
import { ThemeModeScript } from "flowbite-react";
import { NextIntlClientProvider } from "next-intl";
import { Inter } from "next/font/google";
import "../../globals.css";
import Nav from "../../../components/v2/Nav";
import DemoFab from "../../../components/v2/DemoFab";
import { Footer } from "../../../components/v2/sections/Footer";
import { getMessages } from "../../../i18n/request";
import { pageMetadata, organizationJsonLd, type Lang } from "../../../lib/seo";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    metadataBase: new URL("https://modulariot.com"),
    keywords: ["fleet management", "IoT", "real-time data", "streaming", "telematics", "GPS tracking", "sensor data", "open source", "Apache-2.0"],
    authors: [{ name: "MicroboxLabs" }],
    creator: "MicroboxLabs",
    publisher: "MicroboxLabs",
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
    ...pageMetadata({
      lang,
      title: "ModularIoT — De detectar desviaciones a reducirlas",
      description:
        "Plataforma de monitoreo operacional en tiempo real. Convertimos cada señal de tu flota en menos desviaciones repetidas. Código abierto, sin dependencia de proveedores.",
    }),
  };
}

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
      </head>
      <body className="bg-page font-sans text-ink-1 antialiased">
        <NextIntlClientProvider locale={lang} messages={messages}>
          {/* Cascarón compartido: Nav fijo arriba, todo lo demás (contenido de
              página + Footer) vive en el único panel que hace scroll. */}
          <div className="flex h-dvh flex-col overflow-hidden">
            <Nav lang={lang} />
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

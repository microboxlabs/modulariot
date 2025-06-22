import { ThemeModeScript } from "flowbite-react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Modular IoT - Own Your Fleet Data in Real Time",
  description: "Modular IoT is an open-source real-time monitoring platform for fleet data. Stream every GPS ping, sensor value and driver event through your cloud in milliseconds without SaaS handcuffs.",
  keywords: ["fleet management", "IoT", "real-time data", "streaming", "telematics", "GPS tracking", "sensor data", "open source", "Apache-2.0"],
  authors: [{ name: "MicroboxLabs" }],
  creator: "MicroboxLabs",
  publisher: "MicroboxLabs",
  openGraph: {
    title: "Modular IoT - Own Your Fleet Data in Real Time",
    description: "Modular IoT is an open-source real-time monitoring platform for fleet data. Stream every GPS ping, sensor value and driver event through your cloud in milliseconds.",
    url: "https://modulariot.com",
    siteName: "Modular IoT",
    type: "website",
    images: [
      {
        url: "/hero-pipeline.svg",
        width: 400,
        height: 300,
        alt: "Modular IoT Real-time Data Pipeline",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Modular IoT - Own Your Fleet Data in Real Time",
    description: "Modular IoT is an open-source real-time monitoring platform for fleet data. Stream every GPS ping, sensor value and driver event through your cloud in milliseconds.",
    images: ["/hero-pipeline.svg"],
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
  verification: {
    google: "your-google-verification-code",
  },
};

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }, { lang: 'pt' }];
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: 'en' | 'es' | 'pt' }>;
}>) {
  const { lang } = await params;
  
  return (
    <html lang={lang} suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <link rel="canonical" href="https://modulariot.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {children}
      </body>
    </html>
  );
}

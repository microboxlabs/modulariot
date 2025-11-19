import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import ThemeDetector from "@/features/theme/components/ThemeDetector";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { ThemeModeScript } from "flowbite-react";
import { ThemeInit } from "../../.flowbite-react/init";

export const metadata: Metadata = {
  title: "Coordinador Viajes Mintral",
  description: "Sistema de coordinación de viajes para Mintral.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "";

  return (
    <html lang="es" className={theme}>
      <head>
        <ThemeModeScript />
      </head>
      <body className="dark:bg-gray-900">
        <ThemeInit />
        <ThemeDetector>{children}</ThemeDetector>
        <Toaster
          position="bottom-center"
          richColors
          toastOptions={{
            className:
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-white [&>button]:text-gray-900 dark:[&>button]:text-white [&>button]:bg-gray-100 dark:[&>button]:bg-gray-700 [&>button]:hover:bg-gray-200 dark:[&>button]:hover:bg-gray-600",
          }}
          closeButton
        />
      </body>
    </html>
  );
}

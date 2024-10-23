import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import ThemeDetector from "@/features/theme/components/ThemeDetector";

export const metadata: Metadata = {
  title: "Coordinador Viajes Mintral",
  description: "Sistema de coordinación de viajes para Mintral.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <ThemeDetector>
        <body>{children}</body>
      </ThemeDetector>
    </html>
  );
}

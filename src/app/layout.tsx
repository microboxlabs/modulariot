import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import ThemeDetector from "@/features/theme/components/ThemeDetector";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/context/auth-context";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Coordinador Viajes Mintral",
  description: "Sistema de coordinación de viajes para Mintral.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = cookies().get("theme")?.value === "dark" ? "dark" : "";

  return (
    <html lang="es" className={theme}>
      <body className="dark:bg-gray-900">
        <SessionProvider>
          <AuthProvider>
            <ThemeDetector>{children}</ThemeDetector>
          </AuthProvider>
        </SessionProvider>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}

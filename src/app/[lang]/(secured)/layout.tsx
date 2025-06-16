import React from "react";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";
import SecuredLayout from "@/features/layout/components/secured-layout";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { AuthProvider } from "@/features/auth/context/auth-context";

const inter = Inter({ subsets: ["latin"] });

export default async function Layout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  return (
    <main
      className={twMerge(
        inter.className,
        "bg-gray-50 dark:bg-gray-900 h-screen flex flex-col",
      )}
    >
      <SessionProvider basePath="/app/api/auth">
        <AuthProvider>
          <SecuredLayout params={params}>{children}</SecuredLayout>
        </AuthProvider>
      </SessionProvider>
    </main>
  );
}

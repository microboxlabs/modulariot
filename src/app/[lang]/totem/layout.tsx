import React from "react";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

const inter = Inter({ subsets: ["latin"] });

export default async function Layout({
  children,
}: PropsWithChildren<ParamsWithLang>) {
  return (
    <main className={twMerge(inter.className, " dark:bg-gray-900 h-full flex flex-col items-center justify-centers")}>
      {children}
    </main>
  );
}

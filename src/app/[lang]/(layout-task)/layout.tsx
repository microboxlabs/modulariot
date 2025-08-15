import React from "react";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import SecuredTaskLayout from "@/features/layout/components/secured-task-layout";

const inter = Inter({ subsets: ["latin"] });

/**
 * @deprecated This layout is deprecated for non use.
 * This layout is supossed to be used for the task layout but since it has no children, the use of it is not possible.
 */
export default async function Layout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  return (
    <main
      className={twMerge(
        inter.className,
        "bg-gray-50 dark:bg-gray-900 h-screen flex flex-col"
      )}
    >
      <SessionProvider basePath="/app/api/auth">
        <SecuredTaskLayout params={params}>{children}</SecuredTaskLayout>;
      </SessionProvider>
    </main>
  );
}

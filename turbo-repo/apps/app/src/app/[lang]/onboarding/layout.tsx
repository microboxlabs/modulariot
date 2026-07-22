import React from "react";
import type { PropsWithChildren } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

export default async function Layout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  const { lang } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/sign-in`);
  }

  return <>{children}</>;
}

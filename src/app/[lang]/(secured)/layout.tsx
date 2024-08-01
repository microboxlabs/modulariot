import React from "react";
import type { PropsWithChildren } from "react";

import SecuredLayout from "@/features/layout/components/secured-layout";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

export default async function Layout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  return <SecuredLayout params={params}>{children}</SecuredLayout>;
}

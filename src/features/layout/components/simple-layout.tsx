import "server-only";

import React from "react";
import type { PropsWithChildren } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import FooterSecuredLayout from "./footer-secured/footer-secured";
import { SimpleNavbar } from "./simple-navbar/simple-navbar";

export default async function SimpleLayout({
  children,
  params: { lang },
}: PropsWithChildren<ParamsWithLang>) {
  const [dict] = await getDictionary(lang);
  return (
    <>
      <SimpleNavbar />
      {children}
      <FooterSecuredLayout messages={dict} />
    </>
  );
}

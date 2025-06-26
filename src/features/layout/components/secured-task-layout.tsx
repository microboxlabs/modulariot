import React from "react";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { sidebarCookie } from "@/features/sidebar/services/sidebar-cookie.service";
import type { PropsWithChildren } from "react";
import { SecuredNavbar } from "./secured-navbar/secured-navbar";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "../utils/utils";
import FooterSecuredLayout from "./footer-secured/footer-secured";

export default async function SecuredTaskLayout({
  children,
  params: { lang },
}: PropsWithChildren<ParamsWithLang>) {
  const [dict] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  return (
    <SidebarProvider initialCollapsed={sidebarCookie.get().isCollapsed}>
      <SecuredNavbar
        messages={navBarMessages}
        isSidebarToggleEnabled={false}
        isSeachEnabled={false}
        dict={dict as unknown as I18nRecord}
      />
      <div data-testid="content" className="mt-16 mb-6 flex items-center">
        {children}
      </div>

      <FooterSecuredLayout messages={dict} />
    </SidebarProvider>
  );
}

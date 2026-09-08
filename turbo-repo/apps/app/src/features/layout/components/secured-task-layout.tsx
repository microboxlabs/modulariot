import React from "react";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import type { PropsWithChildren } from "react";
import { SecuredNavbar } from "./secured-navbar/secured-navbar";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "../utils/utils";
import FooterSecuredLayout from "./footer-secured/footer-secured";
import { getDomainBranding } from "@/features/branding/domain-branding.service";

export default async function SecuredTaskLayout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  const { lang } = await params;
  const [dict] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  const branding = await getDomainBranding();
  return (
    <SidebarProvider>
      <SecuredNavbar
        messages={navBarMessages}
        isSidebarToggleEnabled={false}
        isSeachEnabled={false}
        dict={dict as unknown as I18nRecord}
        initialOrgLogo={branding?.logoUrl}
        initialOrgLogoDark={branding?.logoUrlDark}
      />
      <div data-testid="content" className="mt-16 mb-6 flex items-center">
        {children}
      </div>

      <FooterSecuredLayout messages={dict} />
    </SidebarProvider>
  );
}

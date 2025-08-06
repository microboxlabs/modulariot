import React from "react";
import { auth } from "@/auth";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { sidebarCookie } from "@/features/sidebar/services/sidebar-cookie.service";
import { LayoutContent } from "@/features/layout/components/layout-content";
import type { PropsWithChildren } from "react";
import { SecuredNavbar } from "./secured-navbar/secured-navbar";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "../utils/utils";
import { SecuredSidebar } from "./secured-sidebar/secured-sidebar";
import FooterSecuredLayout from "./footer-secured/footer-secured";
import SseListener from "@/features/sse/components/sse-listener/sse-listener";

export default async function SecuredLayout({
  children,
  params: { lang },
}: PropsWithChildren<ParamsWithLang>) {
  const [dict, dictionary] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  const session = await auth();
  return (
    <SidebarProvider initialCollapsed={sidebarCookie.get().isCollapsed}>
      <SseListener dictionary={dictionary} tenantId={session!.user.email} />
      <SecuredNavbar
        messages={navBarMessages}
        dict={dictionary as I18nRecord}
      />
      <div
        data-testid="content-with-sidebar"
        className="mt-16 mb-12 flex items-start flex-1 overflow-hidden"
      >
        <SecuredSidebar
          dict={
            ((dictionary.layout as I18nRecord)?.secured as I18nRecord)
              ?.sidebar as I18nRecord
          }
        />
        <LayoutContent>{children}</LayoutContent>
      </div>
      <FooterSecuredLayout messages={dict} />
    </SidebarProvider>
  );
}

import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { LayoutContent } from "@/features/layout/components/layout-content";
import type { PropsWithChildren } from "react";
import { SecuredNavbar } from "./secured-navbar/secured-navbar";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "../utils/utils";
import { SecuredSidebar } from "./secured-sidebar/secured-sidebar";
import FooterSecuredLayout from "./footer-secured/footer-secured";
import SseListener from "@/features/sse/components/sse-listener/sse-listener";
import { getPublicOrgLogo } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { RuntimeConfigProvider } from "@/features/runtime-config/runtime-config-context";
import { KioskShell } from "./kiosk-shell";

export default async function SecuredLayout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  const { lang } = await params;
  const [dict, dictionary] = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  const session = await auth();
  // No session (signed out, or an OAuth sign-in denied by the email-domain
  // allowlist): redirect to sign-in instead of dereferencing a null session
  // below, which would throw and crash the whole secured render.
  if (!session?.user) {
    redirect(`/${lang}/sign-in`);
  }
  const initialOrgLogo = await getPublicOrgLogo();
  const isSearchEnabled = process.env.ENABLE_SEARCHBAR === "true";
  return (
    <RuntimeConfigProvider>
      <SidebarProvider>
        <KioskShell>
          <SseListener
            dictionary={dictionary}
            tenantId={session.user.email}
          />
          <SecuredNavbar
            messages={navBarMessages}
            dict={dictionary as I18nRecord}
            initialOrgLogo={initialOrgLogo}
            isSeachEnabled={isSearchEnabled}
          />
          <div
            data-testid="content-with-sidebar"
            className="mt-16 mb-12 flex items-start flex-1 overflow-hidden overscroll-none"
          >
            <SecuredSidebar
              dict={
                ((dictionary.layout as I18nRecord)?.secured as I18nRecord)
                  ?.sidebar as I18nRecord
              }
            />
            <LayoutContent dict={dictionary as I18nRecord}>{children}</LayoutContent>
          </div>
          <FooterSecuredLayout messages={dict} />
        </KioskShell>
      </SidebarProvider>
    </RuntimeConfigProvider>
  );
}

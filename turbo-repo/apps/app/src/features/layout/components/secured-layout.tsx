import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { LayoutContent } from "@/features/layout/components/layout-content";
import type { PropsWithChildren } from "react";
import { SecuredHeader } from "./unified-header/secured-header";
import { HeaderPageActionsProvider } from "./unified-header/header-page-actions-context";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages, isHarnessUiEnabled } from "../utils/utils";
import { SecuredSidebar } from "./secured-sidebar/secured-sidebar";
import FooterSecuredLayout from "./footer-secured/footer-secured";
import SseListener from "@/features/sse/components/sse-listener/sse-listener";
import { RuntimeConfigProvider } from "@/features/runtime-config/runtime-config-context";
import { KioskShell } from "./kiosk-shell";

const isHarnessSettingsEnabled = process.env.ENABLE_HARNESS_SETTINGS === "true";

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
  // When false/unset, SpotlightSearch isn't rendered at all below, which
  // also removes its Cmd+K listener — there's no client-side toggle to
  // bypass. Also gates the harness-chat toggle in SecuredHeader.
  const isSeachEnabled = isHarnessUiEnabled();
  return (
    <RuntimeConfigProvider>
      <SidebarProvider>
        <KioskShell>
          <HeaderPageActionsProvider>
            <SseListener
              dictionary={dictionary}
              tenantId={session.user.email}
            />
            <SecuredHeader
              messages={navBarMessages}
              dict={dictionary as I18nRecord}
              isSeachEnabled={isSeachEnabled}
              isHarnessSettingsEnabled={isHarnessSettingsEnabled}
            />
            <div
              data-testid="content-with-sidebar"
              className="mt-14 mb-12 flex items-start flex-1 overflow-hidden overscroll-none"
            >
              <SecuredSidebar
                dict={
                  ((dictionary.layout as I18nRecord)?.secured as I18nRecord)
                    ?.sidebar as I18nRecord
                }
                isHarnessSettingsEnabled={isHarnessSettingsEnabled}
              />
              <LayoutContent dict={dictionary as I18nRecord}>
                {children}
              </LayoutContent>
            </div>
            <FooterSecuredLayout messages={dict} />
          </HeaderPageActionsProvider>
        </KioskShell>
      </SidebarProvider>
    </RuntimeConfigProvider>
  );
}

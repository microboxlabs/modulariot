import React from "react";
// import { DashboardNavbar } from "./navbar";
// import { DashboardSidebar } from "./sidebar";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { sidebarCookie } from "@/features/sidebar/services/sidebar-cookie.service";
import { LayoutContent } from "@/features/layout/components/layout-content";
import type { PropsWithChildren } from "react";
import { SecuredNavbar } from "./secured-navbar/secured-navbar";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "../utils/utils";

export default async function SecuredLayout({
  children,
  params: { lang },
}: PropsWithChildren<ParamsWithLang>) {
  const dict = await getDictionary(lang);
  const navBarMessages = buildNavBarMessages({ messages: dict });
  return (
    <SidebarProvider initialCollapsed={sidebarCookie.get().isCollapsed}>
      <SecuredNavbar messages={navBarMessages} />
      <div className="mt-16 flex items-start">
        {/* <DashboardSidebar /> */}
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  );
}

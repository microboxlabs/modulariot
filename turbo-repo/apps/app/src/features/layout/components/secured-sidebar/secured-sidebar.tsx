"use client";

import MobileSidebar from "../mobile-sidebar/mobile-sidebar";
import DesktopSidebar from "../desktop-sidebar/desktop-sidebar";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { SidebarNavigationProvider } from "../../context/sidebar-navigation-context";

interface SecuredSidebarProps extends PropsWithI18nDict {
  readonly isHarnessSettingsEnabled: boolean;
  readonly isDashboardServerEnabled: boolean;
}

export function SecuredSidebar({
  dict,
  isHarnessSettingsEnabled,
  isDashboardServerEnabled,
}: Readonly<SecuredSidebarProps>) {
  return (
    <SidebarNavigationProvider
      isHarnessSettingsEnabled={isHarnessSettingsEnabled}
      isDashboardServerEnabled={isDashboardServerEnabled}
    >
      <div className="lg:hidden">
        <MobileSidebar dict={dict} />
      </div>
      <div className="hidden lg:block h-full">
        <DesktopSidebar dict={dict} />
      </div>
    </SidebarNavigationProvider>
  );
}

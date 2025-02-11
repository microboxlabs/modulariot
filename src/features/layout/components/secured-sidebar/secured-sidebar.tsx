"use client";

import MobileSidebar from "../mobile-sidebar/mobile-sidebar";
import DesktopSidebar from "../desktop-sidebar/desktop-sidebar";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";

export function SecuredSidebar({ dict }: PropsWithI18nDict) {
  return (
    <>
      <div className="lg:hidden">
        <MobileSidebar dict={dict} />
      </div>
      <div className="hidden lg:block">
        <DesktopSidebar dict={dict} />
      </div>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import IconBar from "../icon-bar/icon-bar";
import SecondaryPanel from "../secondary-panel/secondary-panel";

export default function DesktopSidebar({ dict }: Readonly<PropsWithI18nDict>) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { desktop } = useSidebarContext();

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        desktop.activeSection &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        desktop.setActiveSection(null);
      }
    },
    [desktop]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={sidebarRef} className="flex h-full">
      <IconBar dict={dict} />
      <SecondaryPanel dict={dict} />
    </div>
  );
}

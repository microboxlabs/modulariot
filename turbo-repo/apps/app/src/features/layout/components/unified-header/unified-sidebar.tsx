"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type FC,
} from "react";
import Link from "next/link";
import { HiCog } from "react-icons/hi";
import { LynxMark } from "@modulariot/ui/brand/logo";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import IconBar from "@/features/layout/components/icon-bar/icon-bar";
import SecondaryPanel from "@/features/layout/components/secondary-panel/secondary-panel";

interface UnifiedSidebarProps {
  /**
   * Render the owl block on top of the icon rail (rail width). Off for the
   * layout variant that puts the owl in the header instead.
   */
  showLogo?: boolean;
}

/**
 * Side navigation for the unified layout — the exact rail the app already has
 * (IconBar + SecondaryPanel: name-on-hover, click a section to open its L2
 * panel with its own title). The only addition is the owl block pinned above
 * the icon rail.
 */
export function UnifiedSidebar({
  dict,
  showLogo = true,
}: Readonly<PropsWithI18nDict<UnifiedSidebarProps>>) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { desktop } = useSidebarContext();

  // Same click-outside close as the current DesktopSidebar.
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
      <div className="flex h-full flex-col">
        {showLogo && (
          <Link
            href="/"
            aria-label="ModularIoT"
            className="flex h-14 w-14 shrink-0 items-center justify-center border-b border-r border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <LynxMark className="h-8 w-8" />
          </Link>
        )}
        <div className="flex min-h-0 flex-1">
          <IconBar dict={dict} />
        </div>
      </div>
      <SecondaryPanel dict={dict} />
    </div>
  );
}

export const SIDEBAR_SETTINGS_ICON = HiCog as FC<ComponentProps<"svg">>;

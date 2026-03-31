"use client";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Sidebar, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { usePathname } from "next/navigation";
import { twMerge } from "tailwind-merge";
import SidebarItem from "../sidebar-item/sidebar-item";
import BottomMenu from "../bottom-menu/bottom-menu";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { pathNameWithoutLanguage } from "../../utils/utils";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";

export default function DesktopSidebar({ dict }: Readonly<PropsWithI18nDict>) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isCollapsed } = useSidebarContext().desktop;
  const { items, totals } = useSidebarNavigation();

  return (
    <div
      className={twMerge(
        "transition-all duration-200 ease-in-out overflow-hidden h-full",
        isCollapsed ? "w-0" : "w-64"
      )}
    >
      <Sidebar
        aria-label="Sidebar with multi-level dropdown example"
        id="sidebar"
      >
        <div className="flex h-full flex-col justify-between dark:border-gray-700">
          <div className="">
            <SidebarItems>
              <SidebarItemGroup className="mt-0 border-t-0 pb-1 pt-0">
                {items.map((item) => (
                  <SidebarItem
                    key={item.label}
                    {...item}
                    pathname={pathname}
                    label={tr(item.label, dict)}
                    dict={dict}
                    icon={item.icon}
                    totals={totals}
                  />
                ))}
              </SidebarItemGroup>
            </SidebarItems>
          </div>
          <BottomMenu
            isCollapsed={isCollapsed}
            dict={dict}
            pathname={pathname}
          />
        </div>
      </Sidebar>
    </div>
  );
}

"use client";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Sidebar, SidebarItemGroup, SidebarItems } from "flowbite-react";
import SidebarItem from "../sidebar-item/sidebar-item";
import { usePathname } from "next/navigation";
import { twMerge } from "tailwind-merge";
import BottomMenu from "../bottom-menu/bottom-menu";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { pathNameWithoutLanguage } from "../../utils/utils";
import { tr } from "@/features/i18n/tr.service";
import { useSidebarNavigation } from "../../context/sidebar-navigation-context";

export default function MobileSidebar({ dict }: Readonly<PropsWithI18nDict>) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isOpen, close } = useSidebarContext().mobile;
  const { items, totals } = useSidebarNavigation();

  if (!isOpen) return null;

  return (
    <>
      <Sidebar
        aria-label="Sidebar with multi-level dropdown example"
        theme={{
          root: {
            inner:
              "h-full overflow-y-auto overflow-x-hidden bg-gray-50 px-3 py-4 dark:bg-gray-800",
          },
        }}
        className={twMerge(
          "fixed inset-y-0 left-0 z-20 hidden h-full shrink-0 flex-col border-r border-gray-200 pt-16 lg:flex dark:border-gray-700 bg-red-500",
          isOpen && "flex"
        )}
        id="sidebar"
      >
        <div className="flex h-full flex-col justify-between dark:border-gray-700">
          <div className="py-2">
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
          <BottomMenu isCollapsed={false} dict={dict} pathname={pathname} />
        </div>
      </Sidebar>
      <div
        onClick={close}
        aria-hidden="true"
        className="fixed inset-0 z-10 h-full w-full bg-gray-900/50 pt-16 dark:bg-gray-900/90"
      />
    </>
  );
}

"use client";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Sidebar, SidebarItem, TextInput } from "flowbite-react";
import { usePathname } from "next/navigation";
import { HiSearch } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { pages } from "../../models/pages";
import { externalPages } from "../../models/externalPages";
import BottomMenu from "../bottom-menu/bottom-menu";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { pathNameWithoutLanguage } from "../../utils/utils";

export default function MobileSidebar({ dict }: PropsWithI18nDict) {
  // remove first element of pathname which is the language
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isOpen, close } = useSidebarContext().mobile;

  if (!isOpen) return null;

  return (
    <>
      <Sidebar
        aria-label="Sidebar with multi-level dropdown example"
        className={twMerge(
          "fixed inset-y-0 left-0 z-20 hidden h-full shrink-0 flex-col border-r border-gray-200 pt-16 lg:flex dark:border-gray-700",
          isOpen && "flex",
        )}
        id="sidebar"
      >
        <div className="flex h-full flex-col justify-between">
          <div className="py-2">
            <form className="pb-3">
              <TextInput
                icon={HiSearch}
                type="search"
                placeholder="Search"
                required
                size={32}
              />
            </form>
            <Sidebar.Items>
              <Sidebar.ItemGroup className="mt-0 border-t-0 pb-1 pt-0">
                {pages.map((item) => (
                  <SidebarItem key={item.label} {...item} pathname={pathname} />
                ))}
              </Sidebar.ItemGroup>
              <Sidebar.ItemGroup className="mt-2 pt-2">
                {externalPages.map((item) => (
                  <SidebarItem key={item.label} {...item} pathname={pathname} />
                ))}
              </Sidebar.ItemGroup>
            </Sidebar.Items>
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

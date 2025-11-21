"use client";

import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Label, Navbar, NavbarBrand } from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import { HiBell, HiMenuAlt1, HiX } from "react-icons/hi";
import { useMediaQuery } from "../../hooks/use-media-query";
import UserDropdown from "../user-dropdown/user-dropdown";
import { SecuredNavBarProps } from "./secured-navbar.types";
import logoImage from "@assets/logo-mintral-1.png";
import { twMerge } from "tailwind-merge";
/* import { useSearch } from "@/features/search/context/search-context"; */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import { useLoadNotifications } from "@/features/notifications/hooks/use-load-notifications";
import SearchBar from "./searchbar/search-bar";
// import { Filter } from "flowbite-react-icons/outline";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useDebouncedCallback } from "use-debounce";

export function SecuredNavbar({
  messages,
  isSeachEnabled = true,
  isSidebarToggleEnabled = true,
  isUserMenuEnabled = true,
  dict,
}: SecuredNavBarProps & { dict: I18nRecord }) {
  const sidebar = useSidebarContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  /* const { searchTerm, setSearchTerm } = useSearch(); */

  const { data: notifications } = useLoadNotifications();

  let unreadNotifications = 0;
  if (
    notifications &&
    notifications.notifications &&
    Array.isArray(notifications.notifications)
  ) {
    unreadNotifications = notifications.notifications.filter(
      (notification: any) => !notification.is_read
    ).length;
  }

  const _handleSearch = useDebouncedCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      const params = new URLSearchParams(searchParams.toString());

      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    300
  );

  function handleToggleSidebar() {
    if (isDesktop) {
      sidebar.desktop.toggle();
    } else {
      sidebar.mobile.toggle();
    }
  }

  return (
    <Navbar
      fluid
      className="fixed h-16 top-0 z-30 w-full border-b border-gray-200 bg-white p-0 sm:p-0 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="w-full p-3 pr-4">
        <div className="flex flex-row gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center w-fit">
            {isSidebarToggleEnabled && (
              <button
                onClick={handleToggleSidebar}
                className={twMerge(
                  "cursor-pointer rounded p-2 text-gray-600 ",
                  "hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400",
                  "dark:hover:bg-gray-700 dark:hover:text-white"
                )}
              >
                <span className="sr-only">Toggle sidebar</span>
                {/* mobile */}
                <div className="lg:hidden">
                  {sidebar.mobile.isOpen ? (
                    <HiX className="h-6 w-6" />
                  ) : (
                    <HiMenuAlt1 className="h-6 w-6" />
                  )}
                </div>
                {/* desktop */}
                <div className="hidden lg:block">
                  <HiMenuAlt1 className="h-6 w-6" />
                </div>
              </button>
            )}
            {isSeachEnabled && (
              <form className="hidden lg:block lg:pl-2">
                <Label htmlFor="search" className="sr-only">
                  {messages.search}
                </Label>
                <SearchBar
                  messages={messages}
                  searchParams={searchParams}
                  dict={dict}
                />
              </form>
            )}
          </div>
          <div className="items-center justify-center flex-1 hidden lg:flex">
            <NavbarBrand as={Link} href="/">
              <Image className="mr-3 h-8" alt="" src={logoImage} width={150} />
            </NavbarBrand>
          </div>
          <div className="flex items-center justify-end gap-2 w-full">
            <div className="block w-full lg:hidden">
              <SearchBar
                messages={messages}
                searchParams={searchParams}
                dict={dict}
              />
            </div>

            {!pathname.includes("/notifications") && (
              <Link
                href="/notifications"
                className="h-10 w-10 select-none cursor-pointer relative flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600"
              >
                {unreadNotifications > 0 && (
                  <div
                    className={`absolute flex items-center justify-center ${
                      unreadNotifications.toString().length > 1
                        ? "w-7 -left-3"
                        : "w-5 -left-1"
                    } h-5 bg-red-400 dark:bg-red-600 text-xs font-medium text-white rounded-full -top-2  min-w-[1.25rem]`}
                  >
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </div>
                )}
                <span className="sr-only">Notifications</span>
                <HiBell className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </Link>
            )}
            <div className="hidden md:block">
              <CustomThemeToggle />
            </div>
            {isUserMenuEnabled && (
              <div className="flex items-center">
                <UserDropdown messages={messages} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Navbar>
  );
}

"use client";

import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Label, Navbar, TextInput, Tooltip } from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import { HiBell, HiMenuAlt1, HiSearch, HiX } from "react-icons/hi";
import { useMediaQuery } from "../../hooks/use-media-query";
import UserDropdown from "../user-dropdown/user-dropdown";
import { SecuredNavBarProps } from "./secured-navbar.types";
import logoImage from "@assets/logo-mintral-1.png";
import { twMerge } from "tailwind-merge";
/* import { useSearch } from "@/features/search/context/search-context"; */
import { useDebouncedCallback } from "use-debounce";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import React from "react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import { useLoadNotifications } from "@/features/notifications/hooks/use-load-notifications";
// import { Filter } from "flowbite-react-icons/outline";

export function SecuredNavbar({
  messages,
  isSeachEnabled = true,
  isSidebarToggleEnabled = true,
  isUserMenuEnabled = true,
}: SecuredNavBarProps) {
  const sidebar = useSidebarContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathName = usePathname();
  /* const { searchTerm, setSearchTerm } = useSearch(); */

  const { data: notifications } = useLoadNotifications();

  let unreadNotifications = 0;
  if (
    notifications &&
    notifications.notifications &&
    Array.isArray(notifications.notifications)
  ) {
    unreadNotifications = notifications.notifications.filter(
      (notification: any) => !notification.is_read,
    ).length;
  }

  const handleSearch = useDebouncedCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      const params = new URLSearchParams(searchParams.toString());

      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }
      router.push(`${pathName}?${params.toString()}`);
    },
    300,
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
        <div className="flex items-center">
          <div className="flex items-center flex-1 justify-start">
            {isSidebarToggleEnabled && (
              <button
                onClick={handleToggleSidebar}
                className={twMerge(
                  "mr-3 cursor-pointer rounded p-2 text-gray-600 ",
                  "hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400",
                  "dark:hover:bg-gray-700 dark:hover:text-white",
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
                <div className="flex items-center gap-2">
                  <TextInput
                    className="w-full lg:w-96"
                    icon={HiSearch}
                    id="search"
                    name="search"
                    placeholder={messages.search}
                    type="search"
                    defaultValue={searchParams.get("search") || ""}
                    onChange={handleSearch}
                  />
                  {/* @TODO: Add filter button */}
                  {/* <Button color="gray">
                    <Filter className="h-4 w-4" />
                  </Button> */}
                </div>
              </form>
            )}
          </div>
          <div className="flex items-center justify-center flex-1">
            <Navbar.Brand as={Link} href="/">
              <Image className="mr-3 h-8" alt="" src={logoImage} width={150} />
            </Navbar.Brand>
          </div>
          <div className="flex items-center justify-end flex-1 lg:gap-3">
            <div className="flex items-center">
              <button className="cursor-pointer rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:ring-2 focus:ring-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:bg-gray-700 dark:focus:ring-gray-700">
                <span className="sr-only">Search</span>
                <HiSearch className="h-6 w-6" />
              </button>
              {!pathName.includes("/notifications") && (
                <span
                  className="relative border border-gray-200 dark:border-gray-700 cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                  onClick={() => router.push("/notifications")}
                >
                  {unreadNotifications > 0 && (
                    <div className="flex items-center justify-center gap-2 w-5 h-5 bg-red-400 dark:bg-red-600 text-sm dark:text-white rounded-full absolute bottom-[-0.625rem] left-[-0.625rem]">
                      {unreadNotifications}
                    </div>
                  )}
                  <span className="sr-only">Notifications</span>
                  <HiBell className="h-6 w-6" />
                </span>
              )}
              <div className="hidden dark:block">
                <Tooltip content="Toggle light mode">
                  <CustomThemeToggle />
                </Tooltip>
              </div>
              <div className="dark:hidden">
                <Tooltip content="Toggle dark mode">
                  <CustomThemeToggle />
                </Tooltip>
              </div>
              {isUserMenuEnabled && (
                <div className="ml-3 flex items-center">
                  <UserDropdown messages={messages} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Navbar>
  );
}

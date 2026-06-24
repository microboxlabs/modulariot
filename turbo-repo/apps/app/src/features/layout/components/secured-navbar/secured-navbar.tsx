"use client";

import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Navbar, NavbarBrand } from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import { HiBell, HiMenuAlt1, HiX } from "react-icons/hi";
import { useMediaQuery } from "../../hooks/use-media-query";
import UserDropdown from "../user-dropdown/user-dropdown";
import { SecuredNavBarProps } from "./secured-navbar.types";
import defaultLogoImage from "@assets/logo.svg";
import { twMerge } from "tailwind-merge";
/* import { useSearch } from "@/features/search/context/search-context"; */
import { usePathname } from "next/navigation";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import { useLoadNotifications } from "@/features/notifications/hooks/use-load-notifications";
import SpotlightSearch from "./spotlight-search/spotlight-search";
import OrgSwitcher from "./org-switcher/org-switcher";
// import { Filter } from "flowbite-react-icons/outline";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useUserSite } from "@/features/common/providers/client-api.provider";

/**
 * Renders the navbar logo with theme support
 * Uses CSS to switch between light/dark logos instantly
 */
function NavbarLogo({
  isLoading,
  logoUrlLight,
  logoUrlDark,
  initialOrgLogo,
}: Readonly<{
  isLoading: boolean;
  logoUrlLight: string | null;
  logoUrlDark: string | null;
  initialOrgLogo?: string | null;
}>) {
  if (isLoading) {
    // While loading, show the server-fetched org logo if available instead of a skeleton
    if (initialOrgLogo) {
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className="mr-3 h-8 object-contain"
          alt="Company logo"
          src={initialOrgLogo}
          width={150}
          height={32}
        />
      );
    }
    return (
      <div className="mr-3 h-8 w-[150px] bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
    );
  }

  // If we have theme-specific logos, render both and use CSS to show the correct one
  if (logoUrlLight || logoUrlDark) {
    return (
      <>
        {/* Light theme logo (hidden in dark mode) */}
        {logoUrlLight && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="mr-3 h-8 object-contain block dark:hidden"
            alt="Company logo"
            src={logoUrlLight}
            width={150}
            height={32}
          />
        )}
        {/* Dark theme logo (hidden in light mode) */}
        {logoUrlDark && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="mr-3 h-8 object-contain hidden dark:block"
            alt="Company logo"
            src={logoUrlDark}
            width={150}
            height={32}
          />
        )}
        {/* Fallback for light mode if only dark logo exists */}
        {!logoUrlLight && logoUrlDark && (
          <Image
            className="mr-3 h-8 block dark:hidden"
            alt="Mintral logo"
            src={defaultLogoImage}
            width={150}
          />
        )}
        {/* Fallback for dark mode if only light logo exists */}
        {logoUrlLight && !logoUrlDark && (
          <Image
            className="mr-3 h-8 hidden dark:block"
            alt="Mintral logo"
            src={defaultLogoImage}
            width={150}
          />
        )}
      </>
    );
  }

  // No custom logos from SWR - use server-fetched org logo or default
  if (initialOrgLogo) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        className="mr-3 h-8 object-contain"
        alt="Company logo"
        src={initialOrgLogo}
        width={150}
        height={32}
      />
    );
  }

  return (
    <Image
      className="mr-3 h-8"
      alt="Mintral logo"
      src={defaultLogoImage}
      width={150}
    />
  );
}

export function SecuredNavbar({
  messages,
  isSeachEnabled = true,
  isSidebarToggleEnabled = true,
  isUserMenuEnabled = true,
  dict,
  initialOrgLogo,
}: SecuredNavBarProps & { dict: I18nRecord }) {
  const sidebar = useSidebarContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const pathname = usePathname();
  /* const { searchTerm, setSearchTerm } = useSearch(); */

  const { data: notifications } = useLoadNotifications();
  const { logoUrlLight, logoUrlDark, isLoading: isLoadingLogo } = useUserSite();

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

  function handleToggleSidebar() {
    if (!isDesktop) {
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
                  "cursor-pointer rounded p-2 text-gray-600 lg:hidden",
                  "hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400",
                  "dark:hover:bg-gray-700 dark:hover:text-white"
                )}
              >
                <span className="sr-only">Toggle sidebar</span>
                {sidebar.mobile.isOpen ? (
                  <HiX className="h-6 w-6" />
                ) : (
                  <HiMenuAlt1 className="h-6 w-6" />
                )}
              </button>
            )}
            {isSeachEnabled && (
              <div className="hidden lg:block">
                <SpotlightSearch dict={dict} />
              </div>
            )}
          </div>
          <div className="items-center justify-center flex-1 hidden lg:flex">
            <NavbarBrand as={Link} href="/">
              <NavbarLogo
                isLoading={isLoadingLogo}
                logoUrlLight={logoUrlLight}
                logoUrlDark={logoUrlDark}
                initialOrgLogo={initialOrgLogo}
              />
            </NavbarBrand>
          </div>
          <div className="flex items-center justify-end gap-2 w-full">
            <OrgSwitcher dict={dict} />
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

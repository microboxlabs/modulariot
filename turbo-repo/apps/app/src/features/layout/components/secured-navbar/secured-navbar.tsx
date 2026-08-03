"use client";

import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Navbar, NavbarBrand } from "flowbite-react";
import Link from "next/link";
import { HiMenuAlt1, HiX } from "react-icons/hi";
import { useMediaQuery } from "../../hooks/use-media-query";
import UserDropdown from "../user-dropdown/user-dropdown";
import { SecuredNavBarProps } from "./secured-navbar.types";
import { LynxBrand } from "@modulariot/ui/brand/logo";
import { twMerge } from "tailwind-merge";
/* import { useSearch } from "@/features/search/context/search-context"; */
import { usePathname } from "next/navigation";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import NotificationBell from "@/features/integration-jobs/components/notification-bell";
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
          <span className="mr-3 block dark:hidden">
            <LynxBrand iconClassName="h-11 w-11" wordmarkClassName="h-5 w-auto" className="text-(--brand-ink)" />
          </span>
        )}
        {/* Fallback for dark mode if only light logo exists */}
        {logoUrlLight && !logoUrlDark && (
          <span className="mr-3 hidden dark:block">
            <LynxBrand iconClassName="h-11 w-11" wordmarkClassName="h-5 w-auto" className="text-(--brand-ink)" />
          </span>
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
    <LynxBrand className="mr-3 text-(--brand-ink)" iconClassName="h-11 w-11" wordmarkClassName="h-5 w-auto" />
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

  const { logoUrlLight, logoUrlDark, isLoading: isLoadingLogo } = useUserSite();

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
      <div className="w-full p-3">
        <div className="flex flex-row gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center w-fit">
            {isSidebarToggleEnabled && (
              <button
                type="button"
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
              <NotificationBell dict={dict} />
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

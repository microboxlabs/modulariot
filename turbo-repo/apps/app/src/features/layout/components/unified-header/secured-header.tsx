"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiHome, HiMenuAlt1, HiX } from "react-icons/hi";
import { LynxMark } from "@modulariot/ui/brand/logo";
import { twMerge } from "tailwind-merge";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { visiblePages } from "@/features/layout/models/pages";
import {
  isSegmentPrefix,
  pathNameWithoutLanguage,
} from "@/features/layout/utils/utils";
import type { SecuredNavBarProps } from "../secured-navbar/secured-navbar.types";
import SpotlightSearch from "../secured-navbar/spotlight-search/spotlight-search";
import OrgSwitcher from "../secured-navbar/org-switcher/org-switcher";
import UserDropdown from "../user-dropdown/user-dropdown";
import { SystemActions } from "./system-actions";
import { UnifiedHeader } from "./unified-header";

/**
 * Breadcrumb trail for the current route, derived from the nav model so it
 * matches the sidebar's own labels: [section, page]. Routes the model doesn't
 * know fall back to their last path segments.
 */
function useRouteCrumbs(dict: I18nRecord) {
  const pathname = pathNameWithoutLanguage(usePathname());
  return useMemo(() => {
    const sidebarDict = (((dict.layout as I18nRecord)?.secured as I18nRecord)
      ?.sidebar ?? {}) as I18nRecord;
    for (const page of visiblePages(true)) {
      const child = page.items?.find(
        (c) => c.href && isSegmentPrefix(c.href, pathname)
      );
      if (child || (page.href && isSegmentPrefix(page.href, pathname))) {
        return {
          icon: page.icon,
          path: [
            trDynamic(page.label, sidebarDict),
            ...(child ? [trDynamic(child.label, sidebarDict)] : []),
          ],
        };
      }
    }
    const segments = pathname.split("/").filter(Boolean).slice(-2);
    return { icon: undefined, path: segments.length ? segments : ["home"] };
  }, [pathname, dict]);
}

/**
 * The unified header wired for the secured layout: owl square (hamburger below
 * lg), route breadcrumb, spotlight search, and the page / system / user action
 * groups. Replaces SecuredNavbar. Pages still own their SectionHeader (page
 * buttons + filter bar) beneath it.
 */
export function SecuredHeader({
  messages,
  dict,
  isSeachEnabled = true,
  isHarnessSettingsEnabled = false,
}: Readonly<SecuredNavBarProps & { dict: I18nRecord }>) {
  const { mobile } = useSidebarContext();
  const crumbs = useRouteCrumbs(dict);
  const Icon = crumbs.icon ?? HiHome;

  return (
    <UnifiedHeader
      className="fixed inset-x-0 top-0 z-30"
      brand={
        <>
          <button
            type="button"
            onClick={mobile.toggle}
            className={twMerge(
              "cursor-pointer rounded p-2 text-gray-600 lg:hidden",
              "hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400",
              "dark:hover:bg-gray-700 dark:hover:text-white"
            )}
          >
            <span className="sr-only">Toggle sidebar</span>
            {mobile.isOpen ? (
              <HiX className="h-6 w-6" />
            ) : (
              <HiMenuAlt1 className="h-6 w-6" />
            )}
          </button>
          <Link
            href="/"
            aria-label="ModularIoT"
            className="hidden text-gray-900 lg:block dark:text-white"
          >
            <LynxMark className="h-8 w-8" />
          </Link>
        </>
      }
      breadcrumb={
        <Breadcrumb
          path={crumbs.path}
          rootIcon={<Icon className="mr-2 h-4 w-4" />}
          dict={{}}
          disableLinks
        />
      }
      search={
        isSeachEnabled ? (
          <SpotlightSearch
            dict={dict}
            isHarnessSettingsEnabled={isHarnessSettingsEnabled}
          />
        ) : undefined
      }
      systemActions={
        <>
          <OrgSwitcher dict={dict} />
          <SystemActions dict={dict} isSearchEnabled={isSeachEnabled} />
        </>
      }
      userActions={<UserDropdown messages={messages} />}
    />
  );
}

"use client";

import { useState } from "react";
import { Spinner } from "flowbite-react";
import { HiOutlineKey, HiOutlinePhotograph, HiServer } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import BrandingSection from "./branding-section";
import PlatformOwnersCard from "./platform-owners-card";
import PlatformSectionList, {
  type PlatformSectionEntry,
} from "./platform-section-list";
import { useIsPlatformOwner } from "./use-platform-membership";
import type { PlatformSection } from "./platform.types";

interface PlatformPageContentProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Platform.
 *
 * Settings that belong to no organization: they span every tenant, so they sit
 * apart from the org-scoped pages rather than under a chosen organization.
 *
 * One page with a left-hand menu rather than a page per section, matching
 * Settings › Organizations. There are few enough platform settings that
 * spreading them across the sidebar would say more about the navigation than
 * about the product.
 *
 * The page is reachable by URL even though the navigation hides it from
 * non-owners, so it re-checks membership itself. The modulith refuses the
 * writes either way; this only decides whether to offer a surface that could
 * not work.
 */
export default function PlatformPageContent({
  dict,
  lang,
}: PlatformPageContentProps) {
  const platformDict = (dict?.platform as I18nRecord) ?? {};
  const brandingDict = (platformDict?.branding as I18nRecord) ?? {};
  const superusersDict = (platformDict?.superusers as I18nRecord) ?? {};
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  const { isPlatformOwner, isLoading } = useIsPlatformOwner();
  const [selected, setSelected] = useState<PlatformSection>("branding");

  const sections: readonly PlatformSectionEntry[] = [
    {
      id: "branding",
      label: tr("title", brandingDict),
      description: tr("menuHint", brandingDict),
      icon: HiOutlinePhotograph,
    },
    {
      id: "superusers",
      label: tr("title", superusersDict),
      description: tr("menuHint", superusersDict),
      icon: HiOutlineKey,
    },
  ];

  return (
    // Same shell as Settings > Organizations: a full-width breadcrumb bar
    // outside the scroll container, so it never moves — including during
    // rubber-band overscroll — above a capped content column whose list and
    // detail panels scroll internally.
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "platform"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 min-h-0 flex-col gap-4 px-4 pt-2 pb-6 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <HiServer className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", platformDict)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", platformDict)}
            </p>
          </div>
        </div>

        {isLoading && <Spinner size="md" />}

        {!isLoading && !isPlatformOwner && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">{tr("notOwnerTitle", platformDict)}</p>
            <p className="mt-1">{tr("notOwnerBody", platformDict)}</p>
          </div>
        )}

        {!isLoading && isPlatformOwner && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
            <PlatformSectionList
              sections={sections}
              selected={selected}
              onSelect={setSelected}
              dict={platformDict}
            />
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              {selected === "branding" ? (
                <BrandingSection dict={brandingDict} />
              ) : (
                <PlatformOwnersCard dict={superusersDict} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

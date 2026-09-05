"use client";

import { Spinner } from "flowbite-react";
import { HiColorSwatch } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DomainBrandingCard from "./domain-branding-card";
import PlatformOwnersCard from "./platform-owners-card";
import { useIsPlatformOwner } from "./use-platform-membership";

interface BrandingPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Branding: one logo per domain, plus who may set them.
 *
 * The page is reachable by URL even though the navigation hides it from
 * non-owners, so it re-checks membership itself. The modulith refuses the
 * writes either way; this only decides whether to offer a surface that
 * could not work.
 */
export default function BrandingPageContent({
  dict,
  lang,
}: BrandingPageContentProps) {
  const { isPlatformOwner, isLoading } = useIsPlatformOwner();
  const brandingDict = dict?.branding as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  return (
    // Same shell as Settings › Organizations: a full-width breadcrumb bar
    // outside the scroll container, above a capped content column.
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "branding"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-lg flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <HiColorSwatch className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", brandingDict)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", brandingDict)}
            </p>
          </div>
        </div>

        {isLoading && <Spinner size="md" />}

        {!isLoading && !isPlatformOwner && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">{tr("notOwnerTitle", brandingDict)}</p>
            <p className="mt-1">{tr("notOwnerBody", brandingDict)}</p>
          </div>
        )}

        {!isLoading && isPlatformOwner && (
          <>
            <DomainBrandingCard dict={brandingDict} />
            <PlatformOwnersCard dict={brandingDict} />
          </>
        )}
      </div>
    </div>
  );
}

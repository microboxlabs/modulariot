"use client";

import { HiOutlineSparkles } from "react-icons/hi";
import AppLogo from "@/features/common/components/app-logo/app-logo";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import LogoPreview from "./logo-preview";

interface DefaultLogoCardProps {
  readonly dict: I18nRecord;
}

/**
 * The bundled mark, shown for reference.
 *
 * It is what every domain without an entry renders, so an operator deciding
 * whether a domain needs its own logo — or comparing one they just uploaded —
 * has the fallback in front of them rather than from memory. Nothing here is
 * editable: changing the default is a release, not a setting.
 *
 * Rendered through the same `AppLogo` the navbars use, so this cannot drift
 * from what visitors actually see.
 */
export default function DefaultLogoCard({ dict }: DefaultLogoCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <HiOutlineSparkles className="h-5 w-5 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr("defaultTitle", dict)}
        </h3>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("defaultDescription", dict)}
      </p>

      <div className="mt-3 max-w-md">
        <LogoPreview
          lightLabel={tr("previewLight", dict)}
          darkLabel={tr("previewDark", dict)}
        >
          <AppLogo className="" />
        </LogoPreview>
      </div>
    </div>
  );
}

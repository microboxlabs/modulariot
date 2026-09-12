"use client";

import Link from "next/link";
import { HiOutlineClock } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface StoryVersionBadgeProps {
  readonly label: string;
  /** basePath-relative href to the versions page. */
  readonly href: string;
  readonly dict: I18nRecord;
}

/** Breadcrumb badge showing the story's current version — click through to
 * the iteration tree. */
export default function StoryVersionBadge({ label, href, dict }: StoryVersionBadgeProps) {
  return (
    <Link
      href={href}
      title={tr("version.badgeTitle", dict, { label })}
      className="ml-3 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
    >
      <HiOutlineClock className="h-3.5 w-3.5" />
      {tr("version.badgeLabel", dict, { label })}
    </Link>
  );
}

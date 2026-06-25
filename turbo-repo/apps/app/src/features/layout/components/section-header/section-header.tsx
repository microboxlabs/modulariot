"use client";

import React from "react";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { SectionFilterBar } from "@/features/layout/components/secured-navbar/section-filter-bar-controller";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface SectionHeaderProps {
  path?: string[];
  leftContent?: React.ReactNode;
  breadcrumbDict?: I18nRecord;
  filterDict: I18nRecord;
  lang?: string;
  rootIcon?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function SectionHeader({
  path,
  leftContent,
  breadcrumbDict,
  filterDict,
  lang,
  rootIcon,
  rightContent,
}: Readonly<SectionHeaderProps>) {
  return (
    <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 w-full">
      <div className="px-5 h-[60px] flex items-center justify-between dark:text-white border-b border-gray-200 dark:border-gray-700">
        {leftContent ?? (
          path && breadcrumbDict ? (
            <Breadcrumb
              path={path}
              lang={lang}
              rootIcon={rootIcon}
              dict={breadcrumbDict}
              disableLinks
            />
          ) : null
        )}
        {rightContent && (
          <div className="flex items-center gap-2">{rightContent}</div>
        )}
      </div>
      <SectionFilterBar dict={filterDict} />
    </div>
  );
}

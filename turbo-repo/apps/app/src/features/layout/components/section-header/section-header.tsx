"use client";

import React from "react";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SectionFilterBar } from "@/features/layout/components/secured-navbar/section-filter-bar-controller";

interface SectionHeaderProps {
  path?: string[];
  leftContent?: React.ReactNode;
  breadcrumbDict?: I18nRecord;
  filterDict: I18nRecord;
  lang?: string;
  rootIcon?: React.ReactNode;
  rightContent?: React.ReactNode;
  /** When true, clicking the last breadcrumb crumb turns it into an editable text field. */
  editableLastCrumb?: boolean;
  onEditLastCrumb?: (value: string) => void;
}

export function SectionHeader({
  path,
  leftContent,
  breadcrumbDict,
  filterDict,
  lang,
  rootIcon,
  rightContent,
  editableLastCrumb,
  onEditLastCrumb,
}: Readonly<SectionHeaderProps>) {
  return (
    <div className="bg-white dark:bg-gray-900 w-full">
      <div className="px-5 h-[60px] flex items-center justify-between dark:text-white border-b border-gray-200 dark:border-gray-700">
        {leftContent ?? (
          path && breadcrumbDict ? (
            <Breadcrumb
              path={path}
              lang={lang}
              rootIcon={rootIcon}
              dict={breadcrumbDict}
              disableLinks
              editableLast={editableLastCrumb}
              onEditLast={onEditLastCrumb}
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

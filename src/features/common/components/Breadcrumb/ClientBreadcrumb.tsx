"use client";

import React from "react";
import { Breadcrumb as FlowbiteBreadcrumb } from "flowbite-react";
import { HiHome } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface ClientBreadcrumbProps {
  path: string[];
  lang?: string;
  rootIcon?: React.ReactNode;
  rightContent?: React.ReactNode[];
  dict: I18nRecord;
}

export const ClientBreadcrumb: React.FC<ClientBreadcrumbProps> = ({
  path,
  rootIcon = <HiHome className="mr-2 h-4 w-4" />,
  rightContent = [],
  dict,
}) => {
  /* const tr = (key: string, dict?: I18nRecord) => {
    return dict && dict[key] ? (dict[key] as string) : key;
  }; */

  const translatedPath = path.map((item) => tr(item, dict));

  return (
    <div className="flex justify-between items-center">
      <FlowbiteBreadcrumb aria-label="Breadcrumb">
        {translatedPath.map((item, index) =>
          index === 0 ? (
            <FlowbiteBreadcrumb.Item
              icon={() => rootIcon}
              key={index}
            /* href={`/${lang}/${path.slice(0, index + 1).join("/")}`} TODO: Implement path and I18n, */
            >
              {item}
            </FlowbiteBreadcrumb.Item>
          ) : (
            <FlowbiteBreadcrumb.Item
              key={index}
            /* href={`/${lang}/${path.slice(0, index + 1).join("/")}`} */
            >
              {item}
            </FlowbiteBreadcrumb.Item>
          ),
        )}
      </FlowbiteBreadcrumb>
      {rightContent.length > 0 && (
        <div className="flex items-center space-x-2">
          {rightContent.map((content, index) => (
            <React.Fragment key={index}>{content}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

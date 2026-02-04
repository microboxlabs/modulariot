"use client";
import React from "react";
import {
  Breadcrumb as FlowbiteBreadcrumb,
  BreadcrumbItem,
} from "flowbite-react";
import { HiHome } from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface BreadcrumbProps {
  path: string[];
  lang?: string;
  rootIcon?: React.ReactNode;
  rightContent?: React.ReactNode[];
  dict: I18nRecord;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  path,
  lang = "en",
  rootIcon = <HiHome className="mr-2 h-4 w-4" />,
  rightContent = [],
  dict,
}) => {
  const translatedPath = path.map((item) => tr(item, dict));

  return (
    <div className="flex justify-between items-center">
      <FlowbiteBreadcrumb aria-label="Breadcrumb">
        {translatedPath.map((item, index) =>
          index === 0 ? (
            <BreadcrumbItem
              icon={() => rootIcon}
              key={index}
              // href={`/app/${lang}/${path.slice(0, index + 1).join("/")}`}
            >
              {item}
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem
              key={index}
              href={`/app/${lang}/${path.slice(1, index + 1).join("/")}`}
            >
              {item}
            </BreadcrumbItem>
          )
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

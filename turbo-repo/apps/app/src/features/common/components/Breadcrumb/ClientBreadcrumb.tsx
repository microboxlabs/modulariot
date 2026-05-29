"use client";

import React from "react";
import {
  Breadcrumb as FlowbiteBreadcrumb,
  BreadcrumbItem,
} from "flowbite-react";
import { HiHome } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { useParams } from "next/navigation";

export interface BreadcrumbPathItem {
  label: string;
  href?: string;
}

interface ClientBreadcrumbProps {
  path: (string | BreadcrumbPathItem)[];
  rootIcon?: React.ReactNode;
  rightContent?: { key: string; content: React.ReactNode }[];
  dict: I18nRecord;
}

export const ClientBreadcrumb: React.FC<Readonly<ClientBreadcrumbProps>> = ({
  path,
  rootIcon = <HiHome className="mr-2 h-4 w-4" />,
  rightContent = [],
  dict,
}) => {
  const { lang } = useParams<{ lang: string }>();

  const normalizedPath = path.map((item) =>
    typeof item === "string" ? { label: item, href: undefined } : item
  );

  const translatedPath = normalizedPath.map((item) => ({
    ...item,
    label: trDynamic(item.label, dict),
    href: item.href ? `/app/${lang}${item.href}` : undefined,
  }));

  return (
    <div className="flex justify-between items-center">
      <FlowbiteBreadcrumb aria-label="Breadcrumb">
        {translatedPath.map((item, index) =>
          index === 0 ? (
            <BreadcrumbItem
              icon={() => rootIcon}
              key={item.label + index}
              href={item.href}
            >
              {item.label}
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem key={item.label + index} href={item.href}>
              {item.label}
            </BreadcrumbItem>
          )
        )}
      </FlowbiteBreadcrumb>
      {rightContent.length > 0 && (
        <div className="flex items-center space-x-2">
          {rightContent.map((item) => (
            <React.Fragment key={item.key}>{item.content}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";
import {
  Breadcrumb as FlowbiteBreadcrumb,
  BreadcrumbItem,
} from "flowbite-react";
import { HiHome } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { useParams, useRouter } from "next/navigation";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
  const router = useRouter();

  // BreadcrumbItem renders a plain <a href> (flowbite-react's
  // BreadcrumbItem.js), so a left-click would otherwise trigger a full
  // browser navigation instead of a Next.js client-side transition. Modifier
  // clicks (new tab/window) are left alone. Typed as a bare MouseEvent since
  // BreadcrumbItemProps declares onClick against its outer <li> even though
  // it's actually spread onto the inner <a>/<span> at runtime.
  const handleNavigate = (e: React.MouseEvent, href: string | undefined) => {
    if (!href) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // router.push() adds the configured basePath itself (Next's addBasePath,
    // used internally by next/navigation) — href already has it baked in for
    // the native <a> fallback below (right-click "copy link", middle-click),
    // so push the basePath-relative form or "/app" ends up applied twice.
    router.push(href.startsWith(base_path) ? href.slice(base_path.length) : href);
  };

  const normalizedPath = path.map((item) =>
    typeof item === "string" ? { label: item, href: undefined } : item
  );

  const translatedPath = normalizedPath.map((item) => ({
    ...item,
    label: trDynamic(item.label, dict),
    href: item.href ? `${base_path}/${lang}${item.href}` : undefined,
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
              onClick={(e) => handleNavigate(e, item.href)}
            >
              {item.label}
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem
              key={item.label + index}
              href={item.href}
              onClick={(e) => handleNavigate(e, item.href)}
            >
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

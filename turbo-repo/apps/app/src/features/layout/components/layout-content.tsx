"use client";

import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export function LayoutContent({
  children,
  dict: _dict,
}: PropsWithChildren<{ dict: I18nRecord }>) {
  return (
    <div
      id="main-content"
      className={twMerge(
        "relative h-full w-full overflow-y-hidden overflow-x-hidden dark:bg-gray-900 flex flex-col"
      )}
    >
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

"use client";

import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export function LayoutContent({ children }: PropsWithChildren) {
  const sidebar = useSidebarContext();

  return (
    <div
      id="main-content"
      className={twMerge(
        "relative h-full w-full overflow-y-hidden dark:bg-gray-900",
      )}
    >
      {children}
    </div>
  );
}

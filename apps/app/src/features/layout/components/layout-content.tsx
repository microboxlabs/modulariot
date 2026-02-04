"use client";

import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export function LayoutContent({ children }: PropsWithChildren) {
  return (
    <div
      id="main-content"
      className={twMerge(
        "relative h-full w-full overflow-y-hidden overflow-x-hidden dark:bg-gray-900"
      )}
    >
      {children}
    </div>
  );
}

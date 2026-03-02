import React from "react";
import type { PropsWithChildren } from "react";
import { Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";

const inter = Inter({ subsets: ["latin"] });

export default function ExtTasksLayout({ children }: PropsWithChildren) {
  return (
    <main className={twMerge(inter.className, "dark:bg-gray-900 h-full")}>
      {children}
    </main>
  );
}

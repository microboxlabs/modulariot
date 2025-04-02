"use client";

import React from "react";
/* import { useRouter } from "next/navigation"; */
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import StatusCardSkeleton from "./status-card-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  count: string;
  variant?: "black" | "critical";
  dict: I18nRecord;
  icu_condition?: string;
  loading?: boolean;
}

export default function StatusCard({
  icon,
  title,
  count,
  variant = "black",
  icu_condition = "CODE_BLACK",
  loading = false,
}: StatusCardProps) {
  /* const router = useRouter(); */

  const bgColor = variant === "critical" ? "bg-rose-100" : "bg-gray-200";
  const borderColor =
    variant === "critical" ? "border-rose-700" : "border-black";

  if (loading) {
    return <StatusCardSkeleton />;
  }

  return (
    <div
      /* onClick={() => router.push("/symptoms/symptoms-list")} */
      className={twMerge(
        "px-3 py-1",
        "bg-white",
        "rounded-lg",
        "shadow-md",
        "border",
        "border-gray-400",
        "dark:bg-gray-900",
        "hover:bg-gray-100",
        "dark:hover:bg-gray-800",
        "active:bg-gray-200",
        "cursor-pointer",
        "transition-all",
        "w-full",
      )}
    >
      <Link href={`/symptoms/symptoms-list/${icu_condition}`}>
        <div className="flex flex-row justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className={twMerge(
                "w-6 h-6",
                bgColor,
                "rounded-full",
                "border",
                borderColor,
                "flex items-center justify-center",
              )}
            >
              <span className="text-white text-[8px] font-medium">{icon}</span>
            </div>
            <span className="text-[#111928] dark:text-white text-sm font-light hidden lg:block whitespace-nowrap first-letter:uppercase">
              {title}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-gray-500 dark:text-white text-2xl font-medium">
              {count}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

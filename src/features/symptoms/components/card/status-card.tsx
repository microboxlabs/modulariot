"use client";

import React from "react";
/* import { useRouter } from "next/navigation"; */
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import StatusCardSkeleton from "./status-card-skeleton";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  count: string;
  variant?: "black" | "critical";
  dict: any;
  icu_condition?: number;
  loading?: boolean;
}

export default function StatusCard({
  icon,
  title,
  count,
  variant = "black",
  dict,
  icu_condition = 4,
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
        "grow p-3",
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
      )}
    >
      <Link href={`/symptoms/symptoms-list/${icu_condition}`}>
        <div className="flex flex-col gap-2">
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
            <span className="text-[#111928] dark:text-white text-sm font-semibold">
              {title}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-gray-500 dark:text-white text-2xl font-semibold">
              {count}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
              {dict.symptoms.active}
            </span>
          </div>
        </div>
      </Link>
      <div className="flex flex-row justify-between gap-5">
        <div className="flex items-center gap-3">
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
          <span className="text-[#111928] dark:text-white text-sm font-light hidden lg:block whitespace-nowrap">
            {title}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-gray-500 dark:text-white text-2xl font-medium">
            {count}
          </span>
        </div>
      </div>
    </div>
  );
}

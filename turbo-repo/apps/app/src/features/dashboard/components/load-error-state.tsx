"use client";

import Link from "next/link";
import { useState, type ComponentType, type SVGProps } from "react";
import {
  HiArrowLeft,
  HiArrowPath,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

const BUTTON_CLASS =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-gray-700";

const TONE_CLASSES = {
  error: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  neutral: "bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300",
} as const;

/**
 * Something that could not be shown, in place of it: what happened, the
 * likely cause, and a way on (try again, or go back to the list).
 */
export function LoadErrorState({
  title,
  description,
  icon: Icon = HiOutlineExclamationTriangle,
  tone = "error",
  retry,
  back,
  className,
}: Readonly<{
  title: string;
  description: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: keyof typeof TONE_CLASSES;
  retry?: { label: string; onRetry: () => Promise<unknown> };
  back?: { label: string; href: string };
  className?: string;
}>) {
  const [retrying, setRetrying] = useState(false);
  async function tryAgain() {
    if (!retry || retrying) return;
    setRetrying(true);
    try {
      await retry.onRetry();
    } finally {
      setRetrying(false);
    }
  }
  return (
    <div
      role="alert"
      className={twMerge(
        "flex flex-col items-center justify-center gap-4 px-4 py-16 text-center",
        className
      )}
    >
      <span
        aria-hidden
        className={twMerge(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          TONE_CLASSES[tone]
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      {(retry || back) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {back && (
            <Link href={back.href} className={BUTTON_CLASS}>
              <HiArrowLeft aria-hidden className="h-4 w-4" />
              {back.label}
            </Link>
          )}
          {retry && (
            <button
              type="button"
              onClick={() => void tryAgain()}
              disabled={retrying}
              className={BUTTON_CLASS}
            >
              <HiArrowPath
                aria-hidden
                className={twMerge("h-4 w-4", retrying && "animate-spin")}
              />
              {retry.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

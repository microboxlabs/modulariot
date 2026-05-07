"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HiX } from "react-icons/hi";

const STORAGE_KEY = "miot.promo.ribbon.v1.dismissed";

type Props = {
  message: string;
  cta?: { label: string; href: string };
};

export function PromoRibbon({ message, cta }: Props) {
  // Render visible by default — server HTML always includes the ribbon so it
  // appears for first-time visitors without flash. Returning dismissed users
  // get a single-frame FOUC; tradeoff accepted for Phase 1 (revisit in P5
  // polish with an inline-script pattern à la ThemeModeScript).
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setVisible(false);
      }
    } catch {
      // localStorage unavailable (private browsing on some engines) — keep visible
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Site announcement"
      className="relative w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm sm:px-6">
        <span className="text-center sm:text-left">{message}</span>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 font-medium ring-1 ring-white/30 transition-colors hover:bg-white/25"
          >
            {cta.label}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <HiX aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

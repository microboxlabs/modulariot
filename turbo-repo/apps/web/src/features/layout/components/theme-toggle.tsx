"use client";

import { useEffect, useState } from "react";
import { set_theme_cookie } from "@/features/theme/components/CookieThemeChecking";

/**
 * Small light/dark toggle in the site header. Reads the current theme from
 * the existing `.dark` class (set by ThemeDetector after hydration), flips it
 * locally on click, and persists via the same `set_theme_cookie` server action
 * the rest of the theme system uses.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    set_theme_cookie(next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
      title="Toggle theme"
      className="inline-flex h-[34px] items-center justify-center rounded-md border border-hairline bg-surface-1 px-2.5 text-ink-1 transition-colors hover:bg-surface-3 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
    >
      {/* sun (light theme active → click sets dark) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 ${mounted && isDark ? "hidden" : "inline-block"}`}
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* moon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 ${mounted && isDark ? "inline-block" : "hidden"}`}
        aria-hidden
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}

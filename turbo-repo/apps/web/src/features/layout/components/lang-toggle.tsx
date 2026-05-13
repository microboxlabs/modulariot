"use client";

import { useEffect, useState } from "react";

/**
 * EN/ES language toggle stub. Persists the choice in a `lang` cookie so a
 * future locale-aware layer (next-intl, custom dictionary) can read it. For
 * PA-12 this only flips visual state — actual content translation is a
 * separate task; the design system's i18n.jsx provides the Spanish strings
 * when wiring lands.
 */
export function LangToggle() {
  const [lang, setLang] = useState<"en" | "es">("en");

  useEffect(() => {
    // Read on mount; safe fallback if cookie missing
    const match = document.cookie.match(/(?:^|; )lang=(en|es)/);
    if (match && match[1]) setLang(match[1] as "en" | "es");
  }, []);

  const flip = () => {
    const next: "en" | "es" = lang === "en" ? "es" : "en";
    setLang(next);
    // Persist for ~1 year
    document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch language. Current: ${lang.toUpperCase()}`}
      title="Toggle language"
      className="inline-flex h-[34px] items-center gap-0.5 rounded-md border border-hairline bg-surface-1 px-2.5 text-[13px] font-medium text-ink-1 transition-colors hover:bg-surface-3 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
    >
      <span className={lang === "en" ? "font-semibold" : "text-ink-3 dark:text-gray-400"}>
        EN
      </span>
      <span className="text-ink-4 dark:text-gray-600">/</span>
      <span className={lang === "es" ? "font-semibold" : "text-ink-3 dark:text-gray-400"}>
        ES
      </span>
    </button>
  );
}

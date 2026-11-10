"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { withLocale } from "../utils/utils";

/** Prefixes app paths with the current page's locale. */
export function useLocalizedHref(): (href: string) => string {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang;
  return useCallback((href: string) => withLocale(href, lang), [lang]);
}

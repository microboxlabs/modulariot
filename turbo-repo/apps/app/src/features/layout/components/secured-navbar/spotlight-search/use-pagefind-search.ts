"use client";

import { useState, useEffect, useRef } from "react";
import { HiArrowRight } from "react-icons/hi";
import type { SpotlightItem } from "./types";
import type { CanAccessFn } from "./navigate-actions";

interface PagefindResultData {
  url: string;
  meta: Record<string, string | undefined>;
}

interface PagefindInstance {
  search: (query: string) => Promise<{ results: Array<{ data(): Promise<PagefindResultData> }> }>;
}

// Singleton — load once across all hook instances.
// The path is typed as `string` (not a literal) so TypeScript skips static
// module resolution; webpack's webpackIgnore comment prevents bundling.
let pagefindSingleton: PagefindInstance | null = null;
let loadPromise: Promise<PagefindInstance | null> | null = null;

const PAGEFIND_PATH: string = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pagefind/pagefind.js`;

async function loadPagefind(): Promise<PagefindInstance | null> {
  if (pagefindSingleton) return pagefindSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (import(/* webpackIgnore: true */ PAGEFIND_PATH) as Promise<PagefindInstance>)
    .then((pf) => {
      pagefindSingleton = pf;
      return pf;
    })
    .catch(() => null);

  return loadPromise;
}

// ── Fuzzy fallback (used in dev when /pagefind/pagefind.js is not built yet) ──
function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿¡]/g, "");
}

function fuzzyFallback(navigateItems: SpotlightItem[], query: string): SpotlightItem[] {
  if (!query.trim()) return [];
  const q = norm(query.trim());
  const result: SpotlightItem[] = [];
  const seenGroups = new Set<string>();

  for (const item of navigateItems) {
    if (item.isGroupHeader) continue;

    const matches =
      norm(item.label).includes(q) ||
      item.keywords.some((k) => norm(k).includes(q) || q.includes(norm(k)));

    if (!matches) continue;

    if (item.sublabel && !seenGroups.has(item.sublabel)) {
      seenGroups.add(item.sublabel);
      const header = navigateItems.find(
        (i) => i.isGroupHeader && i.label === item.sublabel,
      );
      if (header) result.push(header);
    }

    result.push(item);
  }

  return result;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePagefindSearch(
  query: string,
  navigateItems: SpotlightItem[],
  canAccess: CanAccessFn,
  onNavigate: (href: string) => void,
): SpotlightItem[] {
  const [pagefind, setPagefind] = useState<PagefindInstance | null>(null);
  const [results, setResults] = useState<SpotlightItem[]>([]);
  const cancelRef = useRef(false);

  // Load pagefind once on mount
  useEffect(() => {
    loadPagefind().then(setPagefind);
  }, []);

  useEffect(() => {
    cancelRef.current = false;

    if (!query.trim()) {
      setResults([]);
      return () => {
        cancelRef.current = true;
      };
    }

    // Dev fallback: no pagefind index built yet
    if (!pagefind) {
      setResults(fuzzyFallback(navigateItems, query));
      return () => {
        cancelRef.current = true;
      };
    }

    void pagefind
      .search(query)
      .then(async ({ results: raw }) => {
        const dataList = await Promise.all(
          raw.slice(0, 15).map((r) => r.data()),
        );

        if (cancelRef.current) return;

        const items: SpotlightItem[] = [];
        const seenParents = new Set<string>();

        for (const data of dataList) {
          const { meta } = data;

          const reqGroups = meta.requiredGroups?.split(",").filter(Boolean) ?? [];
          const blkGroups = meta.blockedGroups?.split(",").filter(Boolean) ?? [];
          if (!canAccess(reqGroups, blkGroups)) continue;

          // Re-insert group header when a new parent is encountered
          if (meta.parent && meta.parentId && !seenParents.has(meta.parentId)) {
            seenParents.add(meta.parentId);
            items.push({
              id: `navigate:parent:${meta.parentId}`,
              label: meta.parent,
              kind: "navigate",
              keywords: [],
              onSelect: () => {},
              isGroupHeader: true,
            });
          }

          items.push({
            id: `navigate:${meta.id ?? data.url}`,
            label: meta.title ?? data.url,
            sublabel: meta.parent,
            kind: "navigate",
            icon: HiArrowRight,
            keywords: [],
            onSelect: () => onNavigate(data.url),
          });
        }

        setResults(items);
      })
      .catch(() => {
        if (!cancelRef.current) {
          setResults(fuzzyFallback(navigateItems, query));
        }
      });

    return () => {
      cancelRef.current = true;
    };
  }, [query, pagefind, navigateItems, canAccess, onNavigate]);

  return results;
}

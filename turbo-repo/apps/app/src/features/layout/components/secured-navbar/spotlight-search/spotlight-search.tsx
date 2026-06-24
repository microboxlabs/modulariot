"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { BsStars } from "react-icons/bs";
import { HiArrowRight, HiSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SpotlightItem, SpotlightResultKind } from "./types";
import { buildNavigateItems } from "./navigate-actions";
import { useSpotlightState } from "./use-spotlight-state";
import { useHarnessSearch } from "./use-harness-search";
import { usePagefindSearch } from "./use-pagefind-search";
import { SpotlightBackdrop } from "./spotlight-backdrop";
import { SpotlightInput } from "./spotlight-input";
import { SpotlightResults } from "./spotlight-results";
import { SpotlightEmptyState } from "./spotlight-empty-state";
import { SpotlightFooter } from "./spotlight-footer";
import { KbdHint } from "../searchbar/kbd-hint";

// ── Icon config ───────────────────────────────────────────────────────────────
interface IconConfig {
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

const ICON_COLOR = "text-gray-600 dark:text-gray-300";

const DEFAULT_ICON: IconConfig = {
  icon: HiSearch,
  iconColor: ICON_COLOR,
  iconBg: "bg-gray-100 dark:bg-gray-700",
};

const KIND_ICONS: Record<SpotlightResultKind, IconConfig> = {
  navigate: {
    icon: HiArrowRight,
    iconColor: ICON_COLOR,
    iconBg: "bg-gray-100 dark:bg-gray-700",
  },
  harness: {
    icon: BsStars,
    iconColor: ICON_COLOR,
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
interface SpotlightSearchProps {
  dict: I18nRecord;
}

export default function SpotlightSearch({ dict }: Readonly<SpotlightSearchProps>) {
  const router = useRouter();
  const { userGroups } = usePermissions();

  // ── i18n ─────────────────────────────────────────────────────────────────
  const spotlightDict = dict?.spotlight as I18nRecord | undefined;
  const navigateDict  = spotlightDict?.navigate as I18nRecord | undefined;
  const sidebarLabels = (
    (dict?.layout as I18nRecord | undefined)?.secured as I18nRecord | undefined
  )?.sidebar as I18nRecord | undefined;

  const placeholder     = (spotlightDict?.placeholder as string | undefined) ?? "Search…";
  const recentLabel     = (spotlightDict?.recent       as string | undefined) ?? "Recent";
  const navigateHeading = (navigateDict?.heading       as string | undefined) ?? "Go to";
  const harnessHeading  = (spotlightDict?.harness      as string | undefined) ?? "Harness";

  // ── Stable nav callbacks ──────────────────────────────────────────────────
  const onNavigate = useCallback((href: string) => router.push(href), [router]);

  const canAccess = useCallback(
    (requiredGroups: string[], blockedGroups: string[]) => {
      if (blockedGroups.some((g) => userGroups.includes(g))) return false;
      if (!requiredGroups.length) return true;
      return requiredGroups.some((g) => userGroups.includes(g));
    },
    [userGroups],
  );

  // ── Navigate item registry ────────────────────────────────────────────────
  const navigateItems = useMemo(
    () => buildNavigateItems(sidebarLabels ?? {}, onNavigate, canAccess),
    [sidebarLabels, onNavigate, canAccess],
  );

  // ── Shared refs — kept current synchronously during render ───────────────
  // selectableCountRef: ArrowDown bound in the keyboard handler
  // selectableItemsRef: Enter key → item lookup by index
  // handleSelectRef:    break circular dep between state hook and handleSelect
  const selectableCountRef = useRef(0);
  const selectableItemsRef = useRef<SpotlightItem[]>([]);
  const handleSelectRef    = useRef<((item: SpotlightItem) => void) | null>(null);

  // Stable Enter handler — reads from refs so it never goes stale.
  const handleEnterSelect = useCallback((index: number) => {
    const item = selectableItemsRef.current[index >= 0 ? index : 0];
    if (item) handleSelectRef.current?.(item);
  }, []);

  // ── Core state ────────────────────────────────────────────────────────────
  const {
    isOpen, close,
    query, setQuery,
    selectedIndex, setSelectedIndex,
    recentItems, addRecentItem,
  } = useSpotlightState({
    navigateItems,
    selectableCountRef,
    onEnterSelect: handleEnterSelect,
  });

  // ── Pagefind static search (falls back to fuzzy in dev) ──────────────────
  const staticResults = usePagefindSearch(query, navigateItems, canAccess, onNavigate);

  // ── Debounced harness search ──────────────────────────────────────────────
  const { results: harnessResults, isLoading: isHarnessLoading } =
    useHarnessSearch(query);

  // ── Flat selectable list (no group headers) ───────────────────────────────
  // Static navigate items first, harness results below.
  const selectableItems = useMemo(
    () => [
      ...staticResults.filter((i) => !i.isGroupHeader),
      ...harnessResults,
    ],
    [staticResults, harnessResults],
  );

  // Keep refs current — runs synchronously during render, before any event.
  selectableCountRef.current  = selectableItems.length;
  selectableItemsRef.current  = selectableItems;

  // Auto-select the first result whenever the result set changes.
  useEffect(() => {
    setSelectedIndex(selectableItems.length > 0 ? 0 : -1);
  }, [selectableItems.length, setSelectedIndex]);

  // ── Hover state (icon takes precedence over keyboard selection) ───────────
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Input icon: derived from hovered item → selected item → default ───────
  const activeKind = useMemo((): SpotlightResultKind | null => {
    const id = hoveredId ?? selectableItems[selectedIndex]?.id ?? null;
    if (!id) return null;
    return selectableItems.find((i) => i.id === id)?.kind ?? null;
  }, [hoveredId, selectedIndex, selectableItems]);

  const { icon: ModeIcon, iconColor, iconBg } =
    activeKind ? KIND_ICONS[activeKind] : DEFAULT_ICON;

  // ── Action handler ────────────────────────────────────────────────────────
  const handleSelectAction = useCallback(
    (item: SpotlightItem) => {
      if (item.kind === "navigate") addRecentItem(item);
      item.onSelect();
      close();
    },
    [addRecentItem, close],
  );
  // Keep the ref current so handleEnterSelect always calls the latest version.
  handleSelectRef.current = handleSelectAction;

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isEmpty   = !query.trim();
  const hasResults =
    staticResults.some((i) => !i.isGroupHeader) ||
    harnessResults.length > 0 ||
    isHarnessLoading;

  return (
    <>
      {/* ── Navbar trigger ───────────────────────────────────────────── */}
      <div className="flex flex-row items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="hidden lg:inline">Use</span>
        <KbdHint />
        <span className="hidden lg:inline">to search</span>
      </div>

      {/* ── Overlay ──────────────────────────────────────────────────── */}
      {isOpen && (
        <SpotlightBackdrop onClose={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={placeholder}
            className="relative left-1/2 top-[15%] w-full max-w-2xl -translate-x-1/2 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">

              <SpotlightInput
                query={query}
                placeholder={placeholder}
                onChange={setQuery}
                ModeIcon={ModeIcon}
                iconColor={iconColor}
                iconBg={iconBg}
              />

              <div className="border-t border-gray-100 dark:border-gray-700" />

              {isEmpty && (
                <SpotlightEmptyState
                  recentItems={recentItems}
                  recentLabel={recentLabel}
                  onSelectRecent={handleSelectAction}
                />
              )}

              {!isEmpty && hasResults && (
                <SpotlightResults
                  staticItems={staticResults}
                  harnessItems={harnessResults}
                  isHarnessLoading={isHarnessLoading}
                  selectedItemId={selectableItems[selectedIndex]?.id ?? null}
                  onSelect={handleSelectAction}
                  onHover={setHoveredId}
                  navigateHeading={navigateHeading}
                  harnessHeading={harnessHeading}
                />
              )}

              <SpotlightFooter hasResults={!isEmpty && hasResults} />

            </div>
          </div>
        </SpotlightBackdrop>
      )}
    </>
  );
}

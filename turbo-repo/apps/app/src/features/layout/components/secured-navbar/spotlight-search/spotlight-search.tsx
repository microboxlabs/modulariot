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
import type { SpotlightItem, SpotlightResultKind, HarnessBlock } from "./types";
import { buildNavigateItems } from "./navigate-actions";
import { useSpotlightState } from "./use-spotlight-state";
import { useHarnessSearch } from "./use-harness-search";
import { usePagefindSearch } from "./use-pagefind-search";
import { SpotlightBackdrop } from "./spotlight-backdrop";
import { SpotlightInput } from "./spotlight-input";
import { SpotlightResults } from "./spotlight-results";
import { SpotlightElicitChips } from "./spotlight-elicit-chip";
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
    iconColor: "text-orange-500 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
  },
  "harness-goto": {
    icon: HiArrowRight,
    iconColor: "text-orange-500 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
  },
};

function urlBlockToItem(
  block: HarnessBlock & { type: "url" },
  i: number,
  openUrl: (url: string) => void,
): SpotlightItem {
  return {
    id: `harness-url-${i}`,
    label: block.value.name,
    kind: "harness-goto" as const,
    keywords: [],
    onSelect: () => openUrl(block.value.url),
  };
}

/**
 * Best-effort client signal to the interaction-episode store (semantic-layer
 * learning loop): which harness result the user engaged with. `keepalive` lets
 * it survive the navigation a "go to" selection triggers. Never surfaced on
 * failure — a lost signal must not disrupt the user's action.
 */
function postSpotlightSignal(body: {
  signal: string;
  runId?: string;
  payload?: Record<string, unknown>;
}): void {
  // Prefix the app basePath (/app) like every sibling fetch — without it the
  // POST resolves off-app and 404s in every deployed env, silently dropping the
  // clicked signal (one of the loop's two capture paths).
  void fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/interactions/episodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface: "spotlight", ...body }),
    keepalive: true,
  }).catch(() => {});
}

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

  const placeholder      = (spotlightDict?.placeholder  as string | undefined) ?? "Search…";
  const recentLabel      = (spotlightDict?.recent       as string | undefined) ?? "Recent";
  const navigateHeading  = (navigateDict?.heading       as string | undefined) ?? "Go to";
  const harnessEmptyLabel = (spotlightDict?.harnessEmpty as string | undefined) ?? "No answer found, please try again!";
  const harnessErrorLabel = (spotlightDict?.harnessError as string | undefined) ?? "Something went wrong while searching.";
  const harnessRetryLabel = (spotlightDict?.harnessRetry as string | undefined) ?? "Retry";

  // Chain-of-thought labels for the live progress panel. The dictionary
  // carries both the phase lines and the per-primitive tool labels.
  const progressDict = spotlightDict?.progress as I18nRecord | undefined;
  const harnessProgressLabels = useMemo(
    () => ({
      phases: (progressDict ?? {}) as Record<string, string>,
      tools: ((progressDict?.tools as I18nRecord | undefined) ?? {}) as Record<string, string>,
    }),
    [progressDict],
  );

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
    const item = selectableItemsRef.current[Math.max(index, 0)];
    if (item) handleSelectRef.current?.(item);
  }, []);

  // ── Core state ────────────────────────────────────────────────────────────
  const {
    isOpen, open, close,
    query, setQuery,
    selectedIndex, setSelectedIndex,
    recentItems, addRecentItem,
  } = useSpotlightState({
    navigateItems,
    selectableCountRef,
    onEnterSelect: handleEnterSelect,
  });

  // ── Harness url opener — relative paths navigate in-app (locale-aware),
  //    absolute http(s) urls open a new tab ──────────────────────────────────
  const onOpenHarnessUrl = useCallback(
    (url: string) => {
      if (/^https?:\/\//i.test(url)) {
        globalThis.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      if (url.startsWith("/") && !url.startsWith("//")) {
        router.push(url);
        close();
      }
    },
    [router, close],
  );

  // ── Committed query — only set when user explicitly asks Harness ─────────
  const [committedQuery, setCommittedQuery] = useState("");
  // Bumped by the retry row to re-fire the same committed query.
  const [searchAttempt, setSearchAttempt] = useState(0);

  // Reset when user types a new query so harness results clear.
  useEffect(() => {
    setCommittedQuery("");
    setSearchAttempt(0);
  }, [query]);

  // ── Pagefind static search (falls back to fuzzy in dev) ──────────────────
  const staticResults = usePagefindSearch(query, navigateItems, canAccess, onNavigate);

  // ── Manual harness search — fires only after user commits ─────────────────
  const {
    results: harnessResults,
    isLoading: isHarnessLoading,
    progress: harnessProgress,
  } = useHarnessSearch(committedQuery, searchAttempt);

  // ── "Ask Harness" prompt item — first selectable row while uncommitted ────
  const isEmpty = !query.trim();
  const showHarnessPrompt = !isEmpty && !committedQuery;

  const harnessPromptItem = useMemo(
    () => ({
      id: "__harness-prompt__",
      label: query.trim(),
      sublabel: "Ask Harness",
      kind: "harness" as const,
      icon: BsStars,
      keywords: [],
      isHarnessPrompt: true,
      onSelect: () => setCommittedQuery(query.trim()),
    }),
    [query],
  );

  // ── Retry row — keyboard-selectable after a stream failure ────────────────
  const hasHarnessError = harnessProgress.phase === "error";
  const harnessRetryItem = useMemo<SpotlightItem | null>(
    () =>
      hasHarnessError
        ? {
            id: "__harness-retry__",
            label: harnessRetryLabel,
            kind: "harness" as const,
            icon: BsStars,
            keywords: [],
            // isHarnessPrompt semantics: fire the action, keep the modal open.
            isHarnessPrompt: true,
            onSelect: () => setSearchAttempt((a) => a + 1),
          }
        : null,
    [hasHarnessError, harnessRetryLabel],
  );

  // ── Harness-generated go-to items (url blocks) — keyboard-selectable ────────
  const harnessGoToItems = useMemo<SpotlightItem[]>(() =>
    harnessResults.flatMap((result) =>
      (result.blocks ?? [])
        .filter((b): b is HarnessBlock & { type: "url" } => b.type === "url")
        .map((block, i) => urlBlockToItem(block, i, onOpenHarnessUrl))
    ),
    [harnessResults, onOpenHarnessUrl],
  );

  // ── Flat selectable list (no group headers) ───────────────────────────────
  // Order matches visual layout: prompt → harness gotos → static navigate.
  // Harness markdown answers are non-interactive prose — excluded from keyboard nav.
  const selectableItems = useMemo(
    () => [
      ...(showHarnessPrompt ? [harnessPromptItem] : []),
      ...(harnessRetryItem ? [harnessRetryItem] : []),
      ...harnessGoToItems,
      ...staticResults.filter((i) => !i.isGroupHeader),
    ],
    [showHarnessPrompt, harnessPromptItem, harnessRetryItem, harnessGoToItems, staticResults],
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
      if (item.isHarnessPrompt) {
        item.onSelect();
        return; // keep modal open so the answer can appear
      }
      // Learning-loop signal: the user engaged with a harness result (the
      // answer row `harness:${runId}` or a "go to" link). Best-effort.
      if (item.kind === "harness" || item.kind === "harness-goto") {
        const runId = item.id.startsWith("harness:")
          ? item.id.slice("harness:".length)
          : undefined;
        postSpotlightSignal({
          signal: "clicked",
          runId,
          payload: { itemId: item.id, itemKind: item.kind },
        });
      }
      if (item.kind === "navigate") addRecentItem(item);
      item.onSelect();
      close();
    },
    [addRecentItem, close],
  );
  // Keep the ref current so handleEnterSelect always calls the latest version.
  handleSelectRef.current = handleSelectAction;

  // ── Derived flags ─────────────────────────────────────────────────────────
  const hasResults =
    showHarnessPrompt ||
    staticResults.some((i) => !i.isGroupHeader) ||
    harnessResults.length > 0 ||
    isHarnessLoading ||
    !!committedQuery;

  return (
    <>
      {/* ── Navbar trigger ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={open}
        className="flex items-center w-full lg:w-96 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <HiSearch className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">{placeholder}</span>
        <KbdHint />
      </button>

      {/* ── Overlay ──────────────────────────────────────────────────── */}
      {isOpen && (
        <SpotlightBackdrop onClose={close}>
          <dialog
            open
            aria-label={placeholder}
            className="relative left-1/2 top-[15%] w-full max-w-2xl -translate-x-1/2 px-4 border-0 bg-transparent p-0 m-0 max-h-none overflow-visible"
          >
            <div
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={() => {}}
              role="presentation"
            >

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
                  harnessQueried={!!committedQuery}
                  harnessProgress={harnessProgress}
                  harnessProgressLabels={harnessProgressLabels}
                  harnessError={hasHarnessError}
                  harnessErrorLabel={harnessErrorLabel}
                  harnessRetryItem={harnessRetryItem}
                  harnessPrompt={showHarnessPrompt ? harnessPromptItem : null}
                  selectedItemId={selectableItems[selectedIndex]?.id ?? null}
                  onSelect={handleSelectAction}
                  onHover={setHoveredId}
                  onOpenUrl={onOpenHarnessUrl}
                  navigateHeading={navigateHeading}
                  harnessEmptyLabel={harnessEmptyLabel}
                />
              )}

              <SpotlightElicitChips
                assumptions={harnessProgress.assumptions}
                runId={harnessProgress.runId}
                dict={spotlightDict?.elicit as I18nRecord | undefined}
              />

              <SpotlightFooter hasResults={!isEmpty && hasResults} />

            </div>
          </dialog>
        </SpotlightBackdrop>
      )}
    </>
  );
}

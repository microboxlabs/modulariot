"use client";

import { useOrgScopes } from "./use-org-scopes";
import {
  filterOrgs,
  initials,
  loadRecentSlugs,
  normalize,
  pickRecent,
  pushRecent,
  saveRecentSlugs,
  type SwitcherOrg,
} from "./org-switcher-list";
import {
  HiCheck,
  HiChevronDown,
  HiClock,
  HiOfficeBuilding,
  HiServer,
  HiSearch,
  HiX,
} from "react-icons/hi";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { isPlatformScope } from "@/features/common/platform-scope";

interface OrgSwitcherProps {
  readonly dict: I18nRecord;
}

const LIST_ID = "org-switcher-list";
const RECENT_LABEL_ID = "org-switcher-recent";
const PLATFORM_LABEL_ID = "org-switcher-platform";
const ALL_LABEL_ID = "org-switcher-all";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
];

function avatarColor(slug: string): string {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.codePointAt(0)!) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function optionId(index: number): string {
  return `org-option-${index}`;
}

function nameClasses(isActive: boolean): string {
  if (isActive) return "font-semibold text-blue-700 dark:text-blue-300";
  return "font-medium text-gray-900 dark:text-white";
}

/** The name with the first match of the query's first word in bold. */
function HighlightedName({
  name,
  query,
}: Readonly<{ name: string; query: string }>) {
  const word = normalize(query).split(/\s+/).find(Boolean);
  if (!word) return <>{name}</>;
  const chars = [...name];
  const folded = chars.map((ch) => normalize(ch) || ch).join("");
  const start = folded.indexOf(word);
  if (start < 0 || folded.length !== chars.length) return <>{name}</>;
  const end = start + word.length;
  return (
    <>
      {chars.slice(0, start).join("")}
      <mark className="bg-transparent font-semibold text-blue-600 dark:text-blue-400">
        {chars.slice(start, end).join("")}
      </mark>
      {chars.slice(end).join("")}
    </>
  );
}

function SectionLabel({
  id,
  text,
  count,
}: Readonly<{ id: string; text: string; count?: number }>) {
  return (
    <div
      id={id}
      className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
    >
      <span>{text}</span>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </div>
  );
}

interface OrgOptionProps {
  org: SwitcherOrg;
  index: number;
  isRecent: boolean;
  isActive: boolean;
  isHighlighted: boolean;
  query: string;
  parentLabel: string;
  onSelect: (slug: string) => void;
  onHover: (index: number) => void;
}

function OrgOption({
  org,
  index,
  isRecent,
  isActive,
  isHighlighted,
  query,
  parentLabel,
  onSelect,
  onHover,
}: Readonly<OrgOptionProps>) {
  const highlightClass = isHighlighted ? "bg-gray-100 dark:bg-gray-700/70" : "";
  const subtitle = org.taxId ?? (org.isParent ? parentLabel : null);
  return (
    <button
      id={optionId(index)}
      data-index={index}
      type="button"
      role="option"
      aria-selected={isHighlighted}
      tabIndex={-1}
      onClick={() => onSelect(org.slug)}
      onMouseMove={() => onHover(index)}
      className={`w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer transition-colors duration-150 ${highlightClass}`}
    >
      {isPlatformScope(org.slug) ? (
        <span
          className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          aria-hidden="true"
        >
          <HiServer className="h-4 w-4" />
        </span>
      ) : (
        <span
          className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-xs font-semibold ${avatarColor(org.slug)}`}
          aria-hidden="true"
        >
          {initials(org.displayName)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm truncate ${nameClasses(isActive)}`}>
          <HighlightedName name={org.displayName} query={query} />
        </span>
        {subtitle && (
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </span>
        )}
      </span>
      {isRecent && !isActive && (
        <HiClock className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
      )}
      {isActive && (
        <HiCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      )}
    </button>
  );
}

/**
 * Top-nav org switcher: search by name, slug or tax id, recent orgs first,
 * then every org alphabetically in a scrolling list. Arrow keys move,
 * Enter switches, Escape closes. Hidden when the user has one org.
 */
export default function OrgSwitcher({ dict }: OrgSwitcherProps) {
  const { activeOrg, availableOrgs, isLoading, switchOrg } = useOrgScopes();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeSlug = activeOrg?.slug ?? "";
  const searching = query.trim().length > 0;
  // The platform scope is listed on its own, above the organizations.
  const orgs = useMemo(
    () => availableOrgs.filter((org) => !isPlatformScope(org.slug)),
    [availableOrgs]
  );
  const platform = useMemo(
    () =>
      filterOrgs(
        availableOrgs.filter((org) => isPlatformScope(org.slug)),
        query
      ),
    [availableOrgs, query]
  );

  const recent = useMemo(
    () => (searching ? [] : pickRecent(orgs, recentSlugs, activeSlug)),
    [searching, orgs, recentSlugs, activeSlug]
  );
  const matches = useMemo(() => filterOrgs(orgs, query), [orgs, query]);
  const options = useMemo(
    () => [...platform, ...recent, ...matches],
    [platform, recent, matches]
  );
  // The list can shrink under the highlight when the orgs are re-read.
  const activeIndex = Math.min(highlight, Math.max(options.length - 1, 0));

  const closePanel = useCallback(() => setOpen(false), []);

  /** Closes from the keyboard and puts focus back on the trigger. */
  const dismissPanel = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    setRecentSlugs(loadRecentSlugs());
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }, []);

  const resetSearch = useCallback(() => {
    setQuery("");
    setHighlight(0);
  }, []);

  const handleSwitch = useCallback(
    async (slug: string) => {
      if (slug === activeSlug) {
        closePanel();
        return;
      }
      setSwitching(true);
      closePanel();
      try {
        if (await switchOrg(slug)) {
          // The page is reloading into the new org.
          saveRecentSlugs(pushRecent(loadRecentSlugs(), slug, activeSlug));
          return;
        }
      } catch (error) {
        console.error("Failed to switch organization", error);
        toast.error(
          error instanceof Error
            ? error.message
            : tr("orgSwitcher.changeOrgFailed", dict)
        );
      }
      setSwitching(false);
    },
    [activeSlug, switchOrg, closePanel, dict]
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closePanel]);

  // Escape from anywhere in the page; the search box handles its own first.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && event.target !== inputRef.current) {
        dismissPanel();
      }
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, dismissPanel]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, options, open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlight(Math.min(activeIndex + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlight(Math.max(activeIndex - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setHighlight(0);
        break;
      case "End":
        event.preventDefault();
        setHighlight(Math.max(options.length - 1, 0));
        break;
      case "Enter": {
        event.preventDefault();
        const org = options[activeIndex];
        if (org) void handleSwitch(org.slug);
        break;
      }
      case "Escape":
        event.preventDefault();
        if (query) {
          resetSearch();
        } else {
          dismissPanel();
        }
        break;
    }
  };

  if (isLoading || !activeOrg || availableOrgs.length <= 1) return null;

  const parentLabel = tr("orgSwitcher.parentAccount", dict);
  const allLabel = searching
    ? tr("orgSwitcher.results", dict)
    : tr("orgSwitcher.all", dict);
  const selectOrg = (slug: string) => void handleSwitch(slug);
  const optionFor = (org: SwitcherOrg, index: number, isRecent: boolean) => (
    <OrgOption
      key={org.slug}
      org={org}
      index={index}
      isRecent={isRecent}
      isActive={org.slug === activeSlug}
      isHighlighted={index === activeIndex}
      query={query}
      parentLabel={parentLabel}
      onSelect={selectOrg}
      onHover={setHighlight}
    />
  );

  return (
    <div ref={dropdownRef} className="relative hidden sm:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        disabled={switching}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="h-10 select-none cursor-pointer flex items-center gap-1.5 px-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600 disabled:opacity-50"
      >
        {isPlatformScope(activeSlug) ? (
          <HiServer className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
        ) : (
          <HiOfficeBuilding className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
        )}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">
          {activeOrg.displayName}
        </span>
        <HiChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={tr("orgSwitcher.panelLabel", dict)}
          className="absolute z-50 right-0 top-full mt-2 w-[340px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <HiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={tr("orgSwitcher.searchPlaceholder", dict)}
                aria-label={tr("orgSwitcher.searchPlaceholder", dict)}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={LIST_ID}
                aria-activedescendant={
                  options.length > 0 ? optionId(activeIndex) : undefined
                }
                autoComplete="off"
                spellCheck={false}
                className="w-full h-9 pl-9 pr-8 text-sm rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    resetSearch();
                    inputRef.current?.focus();
                  }}
                  aria-label={tr("orgSwitcher.clear", dict)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <HiX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div
            ref={listRef}
            id={LIST_ID}
            role="listbox"
            className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain px-1.5 pb-1.5"
          >
            {platform.length > 0 && (
              <div
                role="group"
                aria-labelledby={PLATFORM_LABEL_ID}
                className="mb-1 pb-1 border-b border-gray-100 dark:border-gray-700"
              >
                <SectionLabel
                  id={PLATFORM_LABEL_ID}
                  text={tr("orgSwitcher.platform", dict)}
                />
                {platform.map((org, i) => optionFor(org, i, false))}
              </div>
            )}
            {recent.length > 0 && (
              <div
                role="group"
                aria-labelledby={RECENT_LABEL_ID}
                className="mb-1 pb-1 border-b border-gray-100 dark:border-gray-700"
              >
                <SectionLabel
                  id={RECENT_LABEL_ID}
                  text={tr("orgSwitcher.recent", dict)}
                />
                {recent.map((org, i) =>
                  optionFor(org, platform.length + i, true)
                )}
              </div>
            )}
            <div role="group" aria-labelledby={ALL_LABEL_ID}>
              <SectionLabel
                id={ALL_LABEL_ID}
                text={allLabel}
                count={matches.length}
              />
              {matches.map((org, i) =>
                optionFor(org, platform.length + recent.length + i, false)
              )}
            </div>
          </div>
          {options.length === 0 && (
            <div role="status" className="px-3 pb-8 pt-2 text-center">
              <HiSearch className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {tr("orgSwitcher.noResults", dict, { query: query.trim() })}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              <kbd className="font-sans">↑↓</kbd>{" "}
              {tr("orgSwitcher.navigate", dict)}
            </span>
            <span>
              <kbd className="font-sans">↵</kbd>{" "}
              {tr("orgSwitcher.select", dict)}
            </span>
            <span>
              <kbd className="font-sans">esc</kbd>{" "}
              {tr("orgSwitcher.close", dict)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

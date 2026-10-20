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

interface OrgSwitcherProps {
  readonly dict: I18nRecord;
}

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

/** The name with the first match of the query's first word in bold. */
function HighlightedName({ name, query }: { name: string; query: string }) {
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
  const listRef = useRef<HTMLDivElement>(null);

  const activeSlug = activeOrg?.slug ?? "";
  const searching = query.trim().length > 0;

  const recent = useMemo(
    () => (searching ? [] : pickRecent(availableOrgs, recentSlugs, activeSlug)),
    [searching, availableOrgs, recentSlugs, activeSlug]
  );
  const matches = useMemo(
    () => filterOrgs(availableOrgs, query),
    [availableOrgs, query]
  );
  const options = useMemo(() => [...recent, ...matches], [recent, matches]);

  const closePanel = useCallback(() => setOpen(false), []);

  const openPanel = useCallback(() => {
    setRecentSlugs(loadRecentSlugs());
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }, []);

  const handleSwitch = useCallback(
    async (slug: string) => {
      if (slug === activeSlug) {
        closePanel();
        return;
      }
      saveRecentSlugs(pushRecent(loadRecentSlugs(), slug, activeSlug));
      setSwitching(true);
      closePanel();
      try {
        await switchOrg(slug);
      } catch (error) {
        console.error("Failed to switch organization", error);
        toast.error(
          error instanceof Error
            ? error.message
            : tr("orgSwitcher.changeOrgFailed", dict)
        );
        setSwitching(false);
      }
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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlight((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
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
        const org = options[highlight];
        if (org) void handleSwitch(org.slug);
        break;
      }
      case "Escape":
        event.preventDefault();
        if (query) {
          setQuery("");
          setHighlight(0);
        } else {
          closePanel();
        }
        break;
    }
  };

  if (isLoading || !activeOrg || availableOrgs.length <= 1) return null;

  const renderOption = (org: SwitcherOrg, index: number, isRecent: boolean) => {
    const isActive = org.slug === activeSlug;
    const isHighlighted = index === highlight;
    return (
      <button
        key={`${isRecent ? "recent" : "all"}-${org.slug}`}
        id={`org-option-${index}`}
        data-index={index}
        type="button"
        role="option"
        aria-selected={isHighlighted}
        tabIndex={-1}
        onClick={() => handleSwitch(org.slug)}
        onMouseMove={() => setHighlight(index)}
        className={`w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer transition-colors duration-150 ${
          isHighlighted ? "bg-gray-100 dark:bg-gray-700/70" : ""
        }`}
      >
        <span
          className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-xs font-semibold ${avatarColor(org.slug)}`}
          aria-hidden="true"
        >
          {initials(org.displayName)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm truncate ${
              isActive
                ? "font-semibold text-blue-700 dark:text-blue-300"
                : "font-medium text-gray-900 dark:text-white"
            }`}
          >
            <HighlightedName name={org.displayName} query={query} />
          </span>
          {(org.taxId || org.isParent) && (
            <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
              {org.taxId ?? tr("orgSwitcher.parentAccount", dict)}
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
  };

  const sectionLabel = (text: string, count?: number) => (
    <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      <span>{text}</span>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </div>
  );

  return (
    <div ref={dropdownRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        disabled={switching}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-10 select-none cursor-pointer flex items-center gap-1.5 px-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600 disabled:opacity-50"
      >
        <HiOfficeBuilding className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
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
        <div className="absolute z-50 right-0 top-full mt-2 w-[340px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
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
                role="combobox"
                aria-expanded="true"
                aria-controls="org-switcher-list"
                aria-activedescendant={
                  options.length > 0 ? `org-option-${highlight}` : undefined
                }
                autoComplete="off"
                spellCheck={false}
                className="w-full h-9 pl-9 pr-8 text-sm rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setHighlight(0);
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
            id="org-switcher-list"
            role="listbox"
            className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain px-1.5 pb-1.5"
          >
            {recent.length > 0 && (
              <>
                {sectionLabel(tr("orgSwitcher.recent", dict))}
                {recent.map((org, i) => renderOption(org, i, true))}
                <div className="mx-2.5 my-1 border-t border-gray-100 dark:border-gray-700" />
              </>
            )}
            {sectionLabel(
              searching
                ? tr("orgSwitcher.results", dict)
                : tr("orgSwitcher.all", dict),
              matches.length
            )}
            {matches.map((org, i) =>
              renderOption(org, recent.length + i, false)
            )}
            {matches.length === 0 && (
              <div className="px-3 py-8 text-center">
                <HiSearch className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {tr("orgSwitcher.noResults", dict, { query: query.trim() })}
                </p>
              </div>
            )}
          </div>

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

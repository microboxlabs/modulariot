"use client";

import { useState, useEffect, useRef } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import { HiXMark, HiMagnifyingGlass } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type PermitLevel = "read" | "edit";
type PermitEntry = { id: string; displayName: string; level: PermitLevel };

export function PermitsSection({ dictionary }: Readonly<{ dictionary: I18nRecord }>) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; displayName: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [permits, setPermits] = useState<Map<string, PermitEntry>>(new Map());
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (search.length < 3) {
      setResults([]);
      return;
    }
    searchRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/app/api/alfresco/people/search?term=${encodeURIComponent(search)}`);
        const json = await res.json();
        setResults((json.data ?? []).slice(0, 10));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const addPermit = (user: { id: string; displayName: string }, level: PermitLevel) => {
    setPermits((prev) => new Map(prev).set(user.id, { ...user, level }));
    setSearch("");
    setResults([]);
  };

  const removePermit = (userId: string) => {
    setPermits((prev) => { const next = new Map(prev); next.delete(userId); return next; });
  };

  const changeLevel = (userId: string, level: PermitLevel) => {
    setPermits((prev) => {
      const next = new Map(prev);
      const entry = next.get(userId);
      if (entry) next.set(userId, { ...entry, level });
      return next;
    });
  };

  const assignedList = Array.from(permits.values());

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("bento.multimedia.sidebar_permits_search", dictionary)}
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 pr-7 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
        />
        {isSearching ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <HiMagnifyingGlass className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        )}
      </div>

      {search.length > 0 && search.length < 3 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{tr("bento.multimedia.sidebar_permits_min_chars", dictionary)}</p>
      )}

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div className="flex flex-col max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((user) => {
            const isAdded = permits.has(user.id);
            return (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{user.displayName}</span>
                {isAdded ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{tr("bento.multimedia.sidebar_permits_added", dictionary)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addPermit(user, "read")}
                    className="text-sm font-medium text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0 leading-none px-1"
                    title={tr("bento.multimedia.sidebar_permits_add_user", dictionary)}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned users card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {tr("bento.multimedia.sidebar_permits_assigned", dictionary)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {assignedList.length}
          </span>
        </div>

        {/* User list */}
        <div className="flex flex-col max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {assignedList.length > 0 ? (
            assignedList.map(({ id: uid, displayName, level }) => (
              <div key={uid} className="flex items-center gap-2 px-3 py-2 hover:bg-white dark:hover:bg-gray-800/60 transition-colors">
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{displayName}</span>

                {/* Permission dropdown */}
                <Dropdown
                  label={level === "edit" ? tr("bento.multimedia.sidebar_permits_lvl_edit", dictionary) : tr("bento.multimedia.sidebar_permits_lvl_read", dictionary)}
                  size="xs"
                  color="light"
                  className="shrink-0"
                >
                  <DropdownItem onClick={() => changeLevel(uid, "read")}>{tr("bento.multimedia.sidebar_permits_lvl_read", dictionary)}</DropdownItem>
                  <DropdownItem onClick={() => changeLevel(uid, "edit")}>{tr("bento.multimedia.sidebar_permits_lvl_edit", dictionary)}</DropdownItem>
                </Dropdown>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePermit(uid)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  <HiXMark className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-3">
              {tr("bento.multimedia.sidebar_permits_none", dictionary)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { HiSearch, HiPlus } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { Label } from "flowbite-react";
import type { CalendarGroupResponse } from "@microboxlabs/miot-calendar-client";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { createCalendarGroup } from "@/features/common/providers/client-api.provider";
import { ShowNotification } from "@/features/notifications/notification";
import { normalizeCode } from "./create-calendar-modal.config";

interface GroupAutocompleteFieldProps {
  groups: CalendarGroupResponse[];
  value: string; // selected group code
  onChange: (code: string) => void;
  onGroupCreated: (group: CalendarGroupResponse) => void;
  dict: I18nRecord; // full calendar dict
}

const MIN_CHARACTERS = 1;

export function GroupAutocompleteField({
  groups,
  value,
  onChange,
  onGroupCreated,
  dict,
}: Readonly<GroupAutocompleteFieldProps>) {
  // Display the name of the selected group (or empty if none selected)
  const selectedGroup = groups.find((g) => g.code === value);
  const [query, setQuery] = useState(selectedGroup?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display when external value changes
  useEffect(() => {
    const group = groups.find((g) => g.code === value);
    setQuery(group?.name ?? "");
  }, [value, groups]);

  // Filter groups by query
  const filteredGroups = useMemo(() => {
    if (query.length < MIN_CHARACTERS) return groups;
    const lower = query.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(lower) ||
        g.code.toLowerCase().includes(lower)
    );
  }, [query, groups]);

  const hasExactMatch = useMemo(
    () => groups.some((g) => g.name.toLowerCase() === query.toLowerCase()),
    [query, groups]
  );

  const showCreateOption = query.length >= MIN_CHARACTERS && !hasExactMatch;

  // Total items in dropdown: filtered groups + optional create option
  const totalItems = filteredGroups.length + (showCreateOption ? 1 : 0);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Restore display name if user left without selecting
        const group = groups.find((g) => g.code === value);
        setQuery(group?.name ?? "");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, value, groups]);

  const handleSelect = useCallback(
    (group: CalendarGroupResponse) => {
      onChange(group.code);
      setQuery(group.name);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleCreate = useCallback(async () => {
    if (!query.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const newGroup = await createCalendarGroup({
        code: normalizeCode(query.trim()),
        name: query.trim(),
        active: true,
      });
      ShowNotification({
        type: "success",
        message: tr("create.group.successNotification", dict),
      });
      onGroupCreated(newGroup);
      onChange(newGroup.code);
      setQuery(newGroup.name);
      setIsOpen(false);
    } catch (err) {
      ShowNotification({
        type: "error",
        message: err instanceof Error ? err.message : tr("create.group.errorNotification", dict),
      });
    } finally {
      setIsCreating(false);
    }
  }, [query, isCreating, dict, onChange, onGroupCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          setSelectedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < totalItems - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex < filteredGroups.length) {
            handleSelect(filteredGroups[selectedIndex]);
          } else if (showCreateOption) {
            void handleCreate();
          }
          break;
        case "Escape": {
          e.preventDefault();
          setIsOpen(false);
          const escGroup = groups.find((g) => g.code === value);
          setQuery(escGroup?.name ?? "");
          break;
        }
        case "Tab":
          if (selectedIndex < filteredGroups.length) {
            handleSelect(filteredGroups[selectedIndex]);
          }
          break;
      }
    },
    [
      isOpen,
      totalItems,
      filteredGroups,
      selectedIndex,
      showCreateOption,
      handleSelect,
      handleCreate,
      groups,
      value,
    ]
  );

  const createLabel = tr("create.group.create", dict).replace(
    "{name}",
    query.trim()
  );

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="group-autocomplete">
        {tr("create.groupLabel", dict)}
      </Label>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <HiSearch className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            ref={inputRef}
            id="group-autocomplete"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => {
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={tr("create.group.searchPlaceholder", dict)}
            autoComplete="off"
            className={twMerge(
              "block w-full pl-10 pr-4 py-2 text-sm",
              "border border-gray-300 dark:border-gray-600",
              "rounded-lg",
              "bg-white dark:bg-gray-700",
              "text-gray-900 dark:text-white",
              "placeholder-gray-400 dark:placeholder-gray-500",
              "focus:border-blue-500 dark:focus:border-blue-400",
              "focus:outline-none",
              "transition-colors"
            )}
          />
        </div>

        {isOpen && (
          <div
            className={twMerge(
              "absolute z-50 w-full mt-1",
              "bg-white dark:bg-gray-800",
              "border border-gray-200 dark:border-gray-700",
              "rounded-lg shadow-lg",
              "max-h-[220px] overflow-y-auto"
            )}
          >
            <ul className="py-1">
              {filteredGroups.map((group, index) => (
                <li key={group.code}>
                  <button
                    type="button"
                    tabIndex={index === selectedIndex ? 0 : -1}
                    onClick={() => handleSelect(group)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={twMerge(
                      "w-full text-left px-4 py-2 cursor-pointer",
                      "transition-colors border-0 bg-transparent",
                      "text-sm text-gray-900 dark:text-white",
                      index === selectedIndex
                        ? "bg-blue-50 dark:bg-blue-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    {group.name}
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {group.code}
                    </span>
                  </button>
                </li>
              ))}

              {filteredGroups.length === 0 && !showCreateOption && (
                <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {tr("create.group.noResults", dict)}
                </li>
              )}

              {showCreateOption && (
                <li>
                  <button
                    type="button"
                    tabIndex={selectedIndex === filteredGroups.length ? 0 : -1}
                    onClick={() => void handleCreate()}
                    onMouseEnter={() => setSelectedIndex(filteredGroups.length)}
                    disabled={isCreating}
                    className={twMerge(
                      "w-full text-left px-4 py-2 cursor-pointer",
                      "transition-colors border-0 bg-transparent",
                      "text-sm font-medium text-blue-600 dark:text-blue-400",
                      "flex items-center gap-2",
                      selectedIndex === filteredGroups.length
                        ? "bg-blue-50 dark:bg-blue-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700",
                      isCreating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <HiPlus className="w-4 h-4 shrink-0" />
                    {isCreating ? "..." : createLabel}
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

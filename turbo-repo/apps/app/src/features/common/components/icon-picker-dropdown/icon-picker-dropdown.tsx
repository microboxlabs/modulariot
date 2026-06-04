"use client";

import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { usePickerDropdown } from "../../hooks/use-picker-dropdown";
import { ICON_REGISTRY, ICON_KEYS, type IconKey } from "./icon-registry";

/** @deprecated Use IconKey from icon-registry instead */
export interface IconOption<T extends string = string> {
  value: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GRID_COLS = 6;
const DROPDOWN_WIDTH = GRID_COLS * 40 + 16;
const DROPDOWN_HEIGHT = 300;

/* ─── Lazy Icon Cell ─── */

function LazyIconCell({
  iconKey,
  selected,
  onSelect,
}: Readonly<{
  iconKey: IconKey;
  selected: boolean;
  onSelect: (key: IconKey) => void;
}>) {
  const [Icon, setIcon] = useState<ComponentType<{
    className?: string;
  }> | null>(null);
  const [showAbove, setShowAbove] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const entry = ICON_REGISTRY[iconKey];
    if (entry) {
      entry.load()
        .then((mod) => {
          if (!cancelled && mountedRef.current) setIcon(() => mod.default);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [iconKey]);

  const handleMouseEnter = useCallback(() => {
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    // Check against both viewport and the scroll container
    const scrollParent = cellRef.current.closest("[data-icon-grid]");
    if (scrollParent) {
      const containerRect = scrollParent.getBoundingClientRect();
      const spaceBelow = containerRect.bottom - rect.bottom;
      const spaceAbove = rect.top - containerRect.top;
      setShowAbove(spaceBelow < 28 && spaceAbove > 28);
    } else {
      const spaceBelow = window.innerHeight - rect.bottom;
      setShowAbove(spaceBelow < 28);
    }
  }, []);

  const entry = ICON_REGISTRY[iconKey];
  const label = entry?.label ?? iconKey;

  return (
    <div ref={cellRef} className="relative group" onMouseEnter={handleMouseEnter}>
      <button
        type="button"
        aria-label={label}
        onClick={() => onSelect(iconKey)}
        className={twMerge(
          "w-9 h-9 flex items-center justify-center rounded-md transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
          selected &&
            "bg-primary-100 dark:bg-primary-900/40 ring-1 ring-primary-400"
        )}
      >
        {Icon ? (
          <Icon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        ) : (
          <span className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        )}
      </button>
      <span
        className={twMerge(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[10px] leading-tight whitespace-nowrap rounded bg-gray-900 dark:bg-gray-700 text-white opacity-0 group-hover:opacity-100 transition-opacity z-50",
          showAbove ? "bottom-full mb-1" : "top-full mt-1"
        )}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Icon Picker ─── */

interface IconPickerDropdownProps {
  /** Currently selected icon key from the registry */
  value: IconKey;
  /** Callback when an icon is selected */
  onChange: (key: IconKey) => void;
  /** Tooltip for the trigger */
  title?: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Message shown when no icons match the search */
  emptyMessage?: string;
  /** Additional trigger button classes */
  className?: string;
}

/**
 * Icon picker that shows a scrollable grid of icons loaded on demand.
 * Uses dynamic imports so only rendered icons are fetched.
 */
export function IconPickerDropdown({
  value,
  onChange,
  title,
  searchPlaceholder,
  emptyMessage,
  className,
}: Readonly<IconPickerDropdownProps>) {
  const { isOpen, position, triggerRef, toggle, close } = usePickerDropdown({
    portalDataAttribute: "data-iconpicker-portal",
    dropdownWidth: DROPDOWN_WIDTH,
    dropdownHeight: DROPDOWN_HEIGHT,
  });

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredKeys = useMemo(() => {
    if (!search.trim()) return ICON_KEYS;
    const q = search.toLowerCase();
    return ICON_KEYS.filter((key) => {
      const entry = ICON_REGISTRY[key];
      return key.includes(q) || entry?.label.toLowerCase().includes(q);
    });
  }, [search]);

  const handleSelect = useCallback(
    (key: IconKey) => {
      onChange(key);
      close();
    },
    [onChange, close]
  );

  // Render selected icon on trigger
  const [SelectedIcon, setSelectedIcon] = useState<ComponentType<{
    className?: string;
  }> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const entry = ICON_REGISTRY[value];
    if (entry) {
      entry.load()
        .then((mod) => {
          if (!cancelled && mountedRef.current) setSelectedIcon(() => mod.default);
        })
        .catch(() => {});
    } else {
      setSelectedIcon(null);
    }
    return () => { cancelled = true; };
  }, [value]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={twMerge(
          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-primary-300",
          className
        )}
        title={title}
      >
        {SelectedIcon ? (
          <SelectedIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        ) : (
          <span className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600" />
        )}
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            data-iconpicker-portal
            className="no-drag fixed z-9999 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            style={{
              top: position.top,
              left: position.left,
              width: DROPDOWN_WIDTH,
              maxHeight: DROPDOWN_HEIGHT,
            }}
          >
            {/* Search */}
            <div className="px-2 pt-2 pb-1 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder ?? "Search icons…"}
                  className="w-full pl-7 pr-2 py-1 text-xs rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>
            </div>

            {/* Grid */}
            <div data-icon-grid className="overflow-y-auto overflow-x-hidden flex-1 p-2">
              {filteredKeys.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  {emptyMessage ?? "No icons found"}
                </p>
              ) : (
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                  }}
                >
                  {filteredKeys.map((key) => (
                    <LazyIconCell
                      key={key}
                      iconKey={key}
                      selected={value === key}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

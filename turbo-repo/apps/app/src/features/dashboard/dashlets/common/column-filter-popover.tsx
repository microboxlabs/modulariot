"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { HiFunnel, HiCheck } from "react-icons/hi2";
import { Select } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import type { DataType } from "./column-types";
import type {
  ColumnFilter,
  FilterOperator,
} from "./column-filter-types";

// ============================================================================
// Main popover
// ============================================================================

interface ColumnFilterPopoverProps {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly dataType: DataType;
  readonly currentFilter: ColumnFilter | undefined;
  readonly enumValues: string[];
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null,
  ) => void;
}

export function ColumnFilterPopover({
  columnKey,
  columnLabel,
  dataType,
  currentFilter,
  enumValues,
  onFilterChange,
}: ColumnFilterPopoverProps) {
  const { dictionary } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const hasActiveFilter = !!currentFilter;
  const filterTitle = tr("dashboard.settings.columnFilterTitle", dictionary, {
    column: columnLabel,
  });

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? 220;
      const rawLeft = rect.left;
      const clampedLeft = Math.min(rawLeft, window.innerWidth - popoverWidth - 8);
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, clampedLeft) });
    };

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const cancelDebounceRef = useRef<(() => void) | undefined>(undefined);

  const handleClear = useCallback(() => {
    cancelDebounceRef.current?.();
    onFilterChange(columnKey, null);
    setIsOpen(false);
  }, [columnKey, onFilterChange]);

  useEffect(() => {
    return () => {
      cancelDebounceRef.current?.();
    };
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`cursor-pointer rounded p-0.5 transition-colors ${
          hasActiveFilter
            ? "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
        title={filterTitle}
      >
        <HiFunnel className="h-3 w-3" />
      </button>

      {isOpen &&
        createPortal(
          <dialog
            ref={popoverRef}
            open
            aria-label={filterTitle}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
            }}
            className="z-9999 min-w-55 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {filterTitle}
            </div>

            <FilterInput
              columnKey={columnKey}
              dataType={dataType}
              currentFilter={currentFilter}
              enumValues={enumValues}
              onFilterChange={onFilterChange}
              cancelDebounceRef={cancelDebounceRef}
              dictionary={dictionary}
            />

            {hasActiveFilter && (
              <button
                onClick={handleClear}
                className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                {tr("dashboard.settings.columnFilterClear", dictionary)}
              </button>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}

// ============================================================================
// Filter input dispatcher
// ============================================================================

function FilterInput({
  columnKey,
  dataType,
  currentFilter,
  enumValues,
  onFilterChange,
  cancelDebounceRef,
  dictionary,
}: {
  readonly columnKey: string;
  readonly dataType: DataType;
  readonly currentFilter: ColumnFilter | undefined;
  readonly enumValues: string[];
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null,
  ) => void;
  readonly cancelDebounceRef: React.RefObject<(() => void) | undefined>;
  readonly dictionary: I18nRecord;
}) {
  const props = { columnKey, currentFilter, onFilterChange, dictionary };
  switch (dataType) {
    case "text":
      if (enumValues.length > 0 && (!currentFilter || Array.isArray(currentFilter.value))) {
        return <EnumFilter {...props} enumValues={enumValues} />;
      }
      return <TextFilter {...props} cancelDebounceRef={cancelDebounceRef} />;
    case "number":
      return <NumberFilter {...props} cancelDebounceRef={cancelDebounceRef} />;
    case "date":
      return <DateFilter {...props} />;
    case "enum":
      return <EnumFilter {...props} enumValues={enumValues} />;
    case "boolean":
      return <BooleanFilter {...props} />;
  }
}

// ============================================================================
// Shared types
// ============================================================================

interface FilterComponentProps {
  readonly columnKey: string;
  readonly currentFilter: ColumnFilter | undefined;
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null,
  ) => void;
  readonly dictionary: I18nRecord;
}

interface DebouncedFilterComponentProps extends FilterComponentProps {
  readonly cancelDebounceRef?: React.RefObject<(() => void) | undefined>;
}

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-gray-500 dark:focus:ring-gray-600";

const searchInputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-gray-500 dark:focus:ring-gray-600";

// ============================================================================
// Text filter
// ============================================================================

function TextFilter({
  columnKey,
  currentFilter,
  onFilterChange,
  cancelDebounceRef,
  dictionary,
}: DebouncedFilterComponentProps) {
  const [localValue, setLocalValue] = useState(
    (currentFilter?.value as string) || "",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelDebounce = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
  }, []);

  useEffect(() => {
    if (cancelDebounceRef) cancelDebounceRef.current = cancelDebounce;
    return cancelDebounce;
  }, [cancelDebounce, cancelDebounceRef]);

  const handleChange = (value: string) => {
    setLocalValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim() === "") {
        onFilterChange(columnKey, null);
      } else {
        onFilterChange(columnKey, {
          columnKey,
          dataType: "text",
          operator: "contains",
          value,
        });
      }
    }, 300);
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={tr("dashboard.settings.columnFilterSearch", dictionary)}
      autoFocus
      className={inputClass}
    />
  );
}

// ============================================================================
// Number filter
// ============================================================================

function NumberFilter({
  columnKey,
  currentFilter,
  onFilterChange,
  cancelDebounceRef,
  dictionary,
}: DebouncedFilterComponentProps) {
  const [operator, setOperator] = useState<FilterOperator>(
    currentFilter?.operator || "equals",
  );
  const [value, setValue] = useState(
    currentFilter?.operator === "between"
      ? String((currentFilter.value as [number, number])[0])
      : String(currentFilter?.value ?? ""),
  );
  const [value2, setValue2] = useState(
    currentFilter?.operator === "between"
      ? String((currentFilter.value as [number, number])[1])
      : "",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelDebounce = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
  }, []);

  useEffect(() => {
    if (cancelDebounceRef) cancelDebounceRef.current = cancelDebounce;
    return cancelDebounce;
  }, [cancelDebounce, cancelDebounceRef]);

  const emitFilter = useCallback(
    (op: FilterOperator, v1: string, v2: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (v1 === "" && op !== "between") {
          onFilterChange(columnKey, null);
          return;
        }
        if (op === "between") {
          if (v1 === "" && v2 === "") {
            onFilterChange(columnKey, null);
            return;
          }
          const parsedV1 = Number.parseFloat(v1);
          const parsedV2 = Number.parseFloat(v2);
          onFilterChange(columnKey, {
            columnKey,
            dataType: "number",
            operator: "between",
            value: [
              v1 === "" || Number.isNaN(parsedV1) ? -Infinity : parsedV1,
              v2 === "" || Number.isNaN(parsedV2) ? Infinity : parsedV2,
            ],
          });
        } else {
          onFilterChange(columnKey, {
            columnKey,
            dataType: "number",
            operator: op,
            value: Number.parseFloat(v1),
          });
        }
      }, 300);
    },
    [columnKey, onFilterChange],
  );

  return (
    <div className="space-y-2">
      <Select
        sizing="sm"
        value={operator}
        onChange={(e) => {
          const op = e.target.value as FilterOperator;
          setOperator(op);
          emitFilter(op, value, value2);
        }}
      >
        <option value="equals">{tr("dashboard.settings.columnFilterEquals", dictionary)}</option>
        <option value="gt">{tr("dashboard.settings.columnFilterGreaterThan", dictionary)}</option>
        <option value="lt">{tr("dashboard.settings.columnFilterLessThan", dictionary)}</option>
        <option value="between">{tr("dashboard.settings.columnFilterBetween", dictionary)}</option>
      </Select>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          emitFilter(operator, e.target.value, value2);
        }}
        placeholder={operator === "between" ? tr("dashboard.settings.columnFilterMin", dictionary) : tr("dashboard.settings.columnFilterValue", dictionary)}
        autoFocus
        className={inputClass}
      />
      {operator === "between" && (
        <input
          type="number"
          value={value2}
          onChange={(e) => {
            setValue2(e.target.value);
            emitFilter(operator, value, e.target.value);
          }}
          placeholder={tr("dashboard.settings.columnFilterMax", dictionary)}
          className={inputClass}
        />
      )}
    </div>
  );
}

// ============================================================================
// Date filter
// ============================================================================

function DateFilter({
  columnKey,
  currentFilter,
  onFilterChange,
  dictionary,
}: FilterComponentProps) {
  const currentRange = (currentFilter?.value as [string, string]) || ["", ""];
  const [from, setFrom] = useState(currentRange[0]);
  const [to, setTo] = useState(currentRange[1]);

  const emitFilter = useCallback(
    (fromVal: string, toVal: string) => {
      if (!fromVal && !toVal) {
        onFilterChange(columnKey, null);
        return;
      }
      onFilterChange(columnKey, {
        columnKey,
        dataType: "date",
        operator: "dateRange",
        value: [fromVal, toVal],
      });
    },
    [columnKey, onFilterChange],
  );

  const fromId = `date-from-${columnKey}`;
  const toId = `date-to-${columnKey}`;

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor={fromId}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {tr("dashboard.settings.columnFilterFrom", dictionary)}
        </label>
        <input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            emitFilter(e.target.value, to);
          }}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor={toId}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {tr("dashboard.settings.columnFilterTo", dictionary)}
        </label>
        <input
          id={toId}
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            emitFilter(from, e.target.value);
          }}
          className={inputClass}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Enum filter (multi-select checkboxes)
// ============================================================================

function EnumFilter({
  columnKey,
  currentFilter,
  enumValues,
  onFilterChange,
  dictionary,
}: FilterComponentProps & { readonly enumValues: string[] }) {
  const [search, setSearch] = useState("");
  const selected = new Set((currentFilter?.value as string[]) || []);

  const visibleValues = search.trim()
    ? enumValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : enumValues;

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    if (next.size === 0) {
      onFilterChange(columnKey, null);
    } else {
      onFilterChange(columnKey, {
        columnKey,
        dataType: "enum",
        operator: "in",
        value: Array.from(next),
      });
    }
  };

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tr("dashboard.settings.columnFilterSearch", dictionary)}
        className={searchInputClass}
      />
      <div className="max-h-48 space-y-0.5 overflow-y-auto">
        {visibleValues.map((val) => {
          const isChecked = selected.has(val);
          return (
            <button
              key={val}
              type="button"
              onClick={() => toggle(val)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  isChecked
                    ? "border-gray-700 bg-gray-700 dark:border-gray-200 dark:bg-gray-200"
                    : "border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-800"
                }`}
              >
                {isChecked && <HiCheck className="h-2.5 w-2.5 text-white dark:text-gray-800" />}
              </span>
              <span className="truncate">{val || `(${tr("dashboard.settings.columnFilterEmpty", dictionary)})`}</span>
            </button>
          );
        })}
        {visibleValues.length === 0 && (
          <div className="py-2 text-center text-xs italic text-gray-400">
            {search ? tr("dashboard.settings.columnFilterNoMatches", dictionary) : tr("dashboard.settings.columnFilterNoValues", dictionary)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Boolean filter
// ============================================================================

function BooleanFilter({
  columnKey,
  currentFilter,
  onFilterChange,
  dictionary,
}: FilterComponentProps) {
  const currentValue = currentFilter?.value as boolean | null | undefined;

  const handleChange = (val: "all" | "true" | "false") => {
    if (val === "all") {
      onFilterChange(columnKey, null);
    } else {
      onFilterChange(columnKey, {
        columnKey,
        dataType: "boolean",
        operator: "is",
        value: val === "true",
      });
    }
  };

  let selectedVal: "all" | "true" | "false" = "all";
  if (currentValue === true) {
    selectedVal = "true";
  } else if (currentValue === false) {
    selectedVal = "false";
  }

  return (
    <div className="flex flex-col gap-1">
      {(["all", "true", "false"] as const).map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <input
            type="radio"
            name={`bool-filter-${columnKey}`}
            checked={selectedVal === opt}
            onChange={() => handleChange(opt)}
            className="text-orange-500 focus:ring-orange-500"
          />
          <span>
            {opt === "all" && tr("dashboard.settings.columnFilterAll", dictionary)}
            {opt !== "all" && (opt === "true" ? tr("dashboard.settings.columnFilterYes", dictionary) : tr("dashboard.settings.columnFilterNo", dictionary))}
          </span>
        </label>
      ))}
    </div>
  );
}

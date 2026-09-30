"use client";
import { useState, useRef, useEffect, useCallback, useId } from "react";
import type {
  ColumnDataType,
  ColumnFilter,
  FilterOperator,
} from "../core/column-filter-types";

export interface ColumnFilterInputLabels {
  readonly search: string;
  readonly equals: string;
  readonly greaterThan: string;
  readonly lessThan: string;
  readonly between: string;
  readonly min: string;
  readonly value: string;
  readonly max: string;
  readonly from: string;
  readonly to: string;
  readonly empty: string;
  readonly noMatches: string;
  readonly noValues: string;
  readonly all: string;
  readonly yes: string;
  readonly no: string;
  readonly operator: string;
}

export interface ColumnFilterInputProps {
  readonly columnKey: string;
  readonly dataType: ColumnDataType;
  readonly currentFilter: ColumnFilter | undefined;
  readonly enumValues: string[];
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null,
  ) => void;
  readonly cancelDebounceRef?: React.RefObject<(() => void) | null | undefined>;
  readonly labels: ColumnFilterInputLabels;
}

export function ColumnFilterInput({
  columnKey,
  dataType,
  currentFilter,
  enumValues,
  onFilterChange,
  cancelDebounceRef,
  labels,
}: ColumnFilterInputProps) {
  const props = { columnKey, currentFilter, onFilterChange, labels };
  switch (dataType) {
    case "text":
      if (
        enumValues.length > 0 &&
        (!currentFilter || Array.isArray(currentFilter.value))
      ) {
        return (
          <EnumFilter key={columnKey} {...props} enumValues={enumValues} />
        );
      }
      return (
        <TextFilter
          key={columnKey}
          {...props}
          cancelDebounceRef={cancelDebounceRef}
        />
      );
    case "number":
      return (
        <NumberFilter
          key={columnKey}
          {...props}
          cancelDebounceRef={cancelDebounceRef}
        />
      );
    case "date":
      return <DateFilter key={columnKey} {...props} />;
    case "enum":
      return <EnumFilter key={columnKey} {...props} enumValues={enumValues} />;
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
  readonly labels: ColumnFilterInputLabels;
}

interface DebouncedFilterComponentProps extends FilterComponentProps {
  readonly cancelDebounceRef?: React.RefObject<(() => void) | null | undefined>;
}

const inputClass = "miot-column-filter-input__field";
const searchInputClass = inputClass;

// Text filter
// ============================================================================

function TextFilter({
  columnKey,
  currentFilter,
  onFilterChange,
  cancelDebounceRef,
  labels,
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

  useEffect(() => {
    cancelDebounce();
    setLocalValue(
      typeof currentFilter?.value === "string" ? currentFilter.value : "",
    );
  }, [currentFilter?.value, cancelDebounce]);

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
      aria-label={labels.search}
      placeholder={labels.search}
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
  labels,
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

  const selfClearedRef = useRef(false);

  const cancelDebounce = useCallback(() => {
    selfClearedRef.current = false;
    clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
  }, []);

  useEffect(() => {
    if (cancelDebounceRef) cancelDebounceRef.current = cancelDebounce;
    return cancelDebounce;
  }, [cancelDebounce, cancelDebounceRef]);

  useEffect(() => {
    const preserveOperator = !currentFilter && selfClearedRef.current;
    cancelDebounce();
    if (!preserveOperator) setOperator(currentFilter?.operator ?? "equals");
    const range =
      currentFilter?.operator === "between" &&
      Array.isArray(currentFilter.value)
        ? currentFilter.value
        : null;
    const lowerBound =
      range?.[0] === -Number.MAX_VALUE ? "" : String(range?.[0] ?? "");
    setValue(range ? lowerBound : String(currentFilter?.value ?? ""));
    setValue2(
      range && range[1] !== Number.MAX_VALUE ? String(range[1] ?? "") : "",
    );
  }, [currentFilter, cancelDebounce]);

  const emitFilter = useCallback(
    (op: FilterOperator, v1: string, v2: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        selfClearedRef.current = false;
        if (v1 === "" && op !== "between") {
          selfClearedRef.current = true;
          onFilterChange(columnKey, null);
          return;
        }
        if (op === "between") {
          if (v1 === "" && v2 === "") {
            selfClearedRef.current = true;
            onFilterChange(columnKey, null);
            return;
          }
          const parsedV1 = Number.parseFloat(v1);
          const parsedV2 = Number.parseFloat(v2);
          onFilterChange(columnKey, {
            columnKey,
            dataType: "number",
            operator: "between",
            // Finite sentinels survive JSON and cover every supported finite row value.
            value: [
              v1 === "" || Number.isNaN(parsedV1)
                ? -Number.MAX_VALUE
                : parsedV1,
              v2 === "" || Number.isNaN(parsedV2) ? Number.MAX_VALUE : parsedV2,
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
    <div className="miot-column-filter-input">
      <select
        className={inputClass}
        aria-label={labels.operator}
        value={operator}
        onChange={(e) => {
          const op = e.target.value as FilterOperator;
          setOperator(op);
          emitFilter(op, value, value2);
        }}
      >
        <option value="equals">{labels.equals}</option>
        <option value="gt">{labels.greaterThan}</option>
        <option value="lt">{labels.lessThan}</option>
        <option value="between">{labels.between}</option>
      </select>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          emitFilter(operator, e.target.value, value2);
        }}
        aria-label={operator === "between" ? labels.min : labels.value}
        placeholder={operator === "between" ? labels.min : labels.value}
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
          aria-label={labels.max}
          placeholder={labels.max}
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
  labels,
}: FilterComponentProps) {
  const currentRange = (currentFilter?.value as [string, string]) || ["", ""];
  const [from, setFrom] = useState(currentRange[0]);
  const [to, setTo] = useState(currentRange[1]);

  useEffect(() => {
    const range = Array.isArray(currentFilter?.value)
      ? currentFilter.value
      : [];
    setFrom(String(range[0] ?? ""));
    setTo(String(range[1] ?? ""));
  }, [currentFilter]);

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

  const id = useId();
  const fromId = `${id}-from`;
  const toId = `${id}-to`;

  return (
    <div className="miot-column-filter-input">
      <div>
        <label htmlFor={fromId} className="miot-column-filter-input__label">
          {labels.from}
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
        <label htmlFor={toId} className="miot-column-filter-input__label">
          {labels.to}
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
  labels,
}: FilterComponentProps & { readonly enumValues: string[] }) {
  const [search, setSearch] = useState("");
  const selected = new Set((currentFilter?.value as string[]) || []);

  const visibleValues = search.trim()
    ? [...new Set(enumValues)].filter((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      )
    : [...new Set(enumValues)];

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
    <div className="miot-column-filter-input">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={labels.search}
        placeholder={labels.search}
        className={searchInputClass}
      />
      <div className="miot-column-filter-input__options">
        {visibleValues.map((val) => {
          const isChecked = selected.has(val);
          return (
            <label key={val} className="miot-column-filter-input__choice">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(val)}
              />
              <span>{val || `(${labels.empty})`}</span>
            </label>
          );
        })}
        {visibleValues.length === 0 && (
          <div className="miot-column-filter-input__label">
            {search ? labels.noMatches : labels.noValues}
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
  labels,
}: FilterComponentProps) {
  const groupId = useId();
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
    <div className="miot-column-filter-input">
      {(["all", "true", "false"] as const).map((opt) => (
        <label key={opt} className="miot-column-filter-input__choice">
          <input
            type="radio"
            name={groupId}
            checked={selectedVal === opt}
            onChange={() => handleChange(opt)}
            className="miot-column-filter-input__label"
          />
          <span>
            {opt === "all" && labels.all}
            {opt !== "all" && (opt === "true" ? labels.yes : labels.no)}
          </span>
        </label>
      ))}
    </div>
  );
}

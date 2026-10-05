"use client";

import { Dropdown, DropdownDivider, DropdownItem } from "flowbite-react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { inputCls } from "./form-ui";
import type { Categoria } from "./places.types";

const SIN_CATEGORIA = "Sin categoría";

function Punto({ color }: { color?: string }) {
  return (
    <span
      className="h-2.5 w-2.5 flex-none rounded-full border border-gray-300 dark:border-gray-500"
      style={color ? { background: color, borderColor: color } : undefined}
    />
  );
}

/** Selector de categoría con el Dropdown de Flowbite; "" = sin categoría. */
export default function CategoryDropdown({
  value,
  cats,
  onChange,
}: {
  value: string;
  cats: Categoria[];
  onChange: (categoryId: string) => void;
}) {
  const actual = cats.find((c) => String(c.category_id) === value);

  return (
    <Dropdown
      label=""
      inline
      dismissOnClick
      placement="bottom-start"
      renderTrigger={() => (
        <button
          type="button"
          aria-label={`Categoría: ${actual?.name ?? SIN_CATEGORIA}`}
          className={twMerge(inputCls, "flex items-center gap-2 text-left")}
        >
          <Punto color={actual?.color} />
          <span
            className={twMerge(
              "min-w-0 flex-1 truncate",
              !actual && "text-gray-400 dark:text-gray-500"
            )}
          >
            {actual?.name ?? SIN_CATEGORIA}
          </span>
          <HiChevronDown className="h-3.5 w-3.5 flex-none text-gray-400" />
        </button>
      )}
    >
      <div className="max-h-60 overflow-y-auto">
        <DropdownItem onClick={() => onChange("")}>
          <span className="flex w-full items-center gap-2">
            <Punto />
            <span className="flex-1">{SIN_CATEGORIA}</span>
            {!actual && <HiCheck className="h-4 w-4 text-blue-600" />}
          </span>
        </DropdownItem>
        {cats.length > 0 && <DropdownDivider />}
        {cats.map((c) => (
          <DropdownItem
            key={c.category_id}
            onClick={() => onChange(String(c.category_id))}
          >
            <span className="flex w-full items-center gap-2">
              <Punto color={c.color} />
              <span className="flex-1 truncate">{c.name}</span>
              {actual?.category_id === c.category_id && (
                <HiCheck className="h-4 w-4 text-blue-600" />
              )}
            </span>
          </DropdownItem>
        ))}
      </div>
    </Dropdown>
  );
}

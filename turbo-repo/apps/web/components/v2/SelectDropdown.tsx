"use client";

import { Dropdown, DropdownItem } from "flowbite-react";

// Select estilizado con el Dropdown de flowbite-react (ya es dependencia del
// proyecto): mismo look que los demás campos del formulario (border-hairline-
// strong, bg-surface, focus:accent), pero con panel de opciones propio en vez
// del <select> nativo del navegador.

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Dropdown
      inline
      label=""
      arrowIcon={false}
      theme={{
        floating: {
          base: "z-50 w-64 divide-y divide-hairline overflow-hidden rounded-lg shadow-lg focus:outline-none",
          content: "max-h-64 overflow-auto py-1 text-sm text-ink-2",
          style: {
            light: "border border-hairline bg-surface text-ink-1",
            dark: "border border-hairline bg-surface text-ink-1",
            auto: "border border-hairline bg-surface text-ink-1",
          },
          item: {
            container: "",
            base: "flex w-full cursor-pointer items-center justify-start px-3.5 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink-1 focus:bg-surface-2 focus:outline-none",
            icon: "mr-2 h-4 w-4",
          },
        },
      }}
      renderTrigger={() => (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-hairline-strong bg-surface px-3.5 py-2.5 text-left text-sm transition-colors hover:border-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <span className={value ? "text-ink-1" : "text-ink-4"}>{value || placeholder}</span>
          <svg className="h-4 w-4 shrink-0 text-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    >
      {options.map((o) => (
        <DropdownItem key={o} onClick={() => onChange(o)}>
          {o}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

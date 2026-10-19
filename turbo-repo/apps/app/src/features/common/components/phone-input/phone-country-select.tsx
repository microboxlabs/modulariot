"use client";

import type { ComponentType, SVGProps } from "react";
import { Dropdown, DropdownDivider, DropdownItem } from "flowbite-react";
import { HiChevronDown, HiOutlineGlobeAlt } from "react-icons/hi2";
import { getCountryCallingCode, type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

type CountryOption = {
  value?: Country;
  label: string;
  divider?: boolean;
};

type PhoneCountrySelectProps = Readonly<{
  value?: Country;
  onChange: (value?: Country) => void;
  options: readonly CountryOption[];
  disabled?: boolean;
}>;

// The library's own EmbeddedFlagProps type only declares `title`, but each
// flag component actually spreads the rest of its props onto an <svg> —
// confirmed in react-phone-number-input/flags' source.
type FlagComponent = ComponentType<
  SVGProps<SVGSVGElement> & { title?: string }
>;

function CountryFlag({
  country,
  label,
}: Readonly<{ country?: Country; label: string }>) {
  const Flag = country
    ? (flags as Record<string, FlagComponent>)[country]
    : undefined;
  if (!Flag) {
    // "International" (no specific country selected) — the default state
    // when no `defaultCountry` is given.
    return (
      <HiOutlineGlobeAlt
        aria-hidden="true"
        className="h-4 w-5 shrink-0 text-gray-400"
      />
    );
  }
  return <Flag title={label} className="h-4 w-5 shrink-0 rounded-[2px]" />;
}

// Replaces react-phone-number-input's native <select> with a Flowbite
// Dropdown styled as the number input's addon, so the two pieces read as
// one field instead of a raw unstyled <select>.
export default function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled,
}: PhoneCountrySelectProps) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "";

  return (
    <Dropdown
      label=""
      dismissOnClick
      placement="bottom-start"
      renderTrigger={() => (
        <button
          type="button"
          disabled={disabled}
          className="flex shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <CountryFlag country={value} label={selectedLabel} />
          <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      )}
      // PhoneInput's wrapper is `relative` and this menu renders inside it,
      // so `w-full` makes the menu exactly as wide as the whole field.
      className="max-h-64 w-full overflow-y-auto"
    >
      {options.map((option) =>
        option.divider ? (
          <DropdownDivider key="divider" />
        ) : (
          <DropdownItem
            key={option.value ?? "ZZ"}
            onClick={() => onChange(option.value)}
          >
            <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              <CountryFlag country={option.value} label={option.label} />
              <span className="truncate">
                {option.label}
                {option.value && (
                  <span className="text-gray-400">
                    {" "}
                    (+{getCountryCallingCode(option.value)})
                  </span>
                )}
              </span>
            </span>
          </DropdownItem>
        )
      )}
    </Dropdown>
  );
}

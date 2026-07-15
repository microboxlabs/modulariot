"use client";

import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { TextInput } from "flowbite-react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { COUNTRIES } from "@/features/auth/constants/countries.constants";

type CountryComboboxProps = Readonly<{
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  noResultsLabel: string;
}>;

// A plain TextInput + custom floating list rather than Flowbite's Dropdown:
// Dropdown's trigger toggles open/closed on every click of the reference
// element, which would close the list back up the moment you click back
// into the input to keep typing. Positioning/open state here is instead
// driven by actual focus, which is what a searchable combobox needs.
export default function CountryCombobox({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  noResultsLabel,
}: CountryComboboxProps) {
  const [query, setQuery] = useState(value ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? COUNTRIES.filter((country) =>
        country.toLowerCase().includes(normalizedQuery)
      )
    : COUNTRIES;

  function selectCountry(country: string) {
    onChange(country);
    setQuery(country);
    setIsOpen(false);
    // Re-arm the readonly-until-focus guard for next time (see the input's
    // `readOnly` comment below). Doesn't happen via the container's onBlur
    // below: clicking a result unmounts it (via `isOpen` becoming false)
    // mid-click, so focus ends up moving to `<body>` rather than cleanly
    // "blurring the container to somewhere outside it" — the container's
    // onBlur handler never sees that as a real departure.
    inputRef.current?.setAttribute("readonly", "");
  }

  function handleContainerBlur(event: FocusEvent<HTMLDivElement>) {
    // Moving focus to a result button inside this same widget isn't
    // "leaving" the combobox — only revert/close once focus actually goes
    // elsewhere on the page.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setQuery(value ?? "");
    setIsOpen(false);
    // Re-arm the readonly-until-focus guard (see the input's `readOnly`
    // comment below) for the next time this field is focused.
    inputRef.current?.setAttribute("readonly", "");
    onBlur?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (results.length > 0) selectCountry(results[0]);
    } else if (event.key === "Escape") {
      setQuery(value ?? "");
      setIsOpen(false);
      event.currentTarget.blur();
    }
  }

  return (
    // The `[&_input::...]` selector (not on TextInput's own `className`,
    // which lands on its outer wrapper, not the <input>) hides the native
    // "clear" (x) button that `type="search"` brings in WebKit/Blink —
    // this is a country picker, not free text, so a one-click
    // erase-everything affordance on it doesn't make sense.
    <div
      className="relative [&_input::-webkit-search-cancel-button]:appearance-none"
      onBlur={handleContainerBlur}
    >
      <TextInput
        ref={inputRef}
        id={id}
        // This is a search/filter box, not a data-entry field — `type="search"`
        // says so explicitly, which keeps it out of Chrome's address-autofill
        // targeting in the first place (that heuristic is scoped to
        // `type="text"`/similar data-entry inputs).
        type="search"
        // Not `name={name}`: this is a fully controlled field (committed via
        // `onChange` on selection, not native form submission), and giving
        // it a real `name`/autocomplete-shaped attributes is exactly what
        // triggers Chrome's own address-suggestion popover on top of ours.
        //
        // `autocomplete="off"` alone doesn't stop Chrome's own saved-entry
        // history dropdown — that one specifically ignores "off". Chrome
        // does, however, always respect "new-password": it's the one token
        // it guarantees never to autofill or suggest from, so it's become
        // the standard (if odd-looking) way to fully opt a field out —
        // password-specific in name only, not in effect.
        autoComplete="new-password"
        // Chrome ignores `autocomplete="off"` outright for fields it
        // heuristically decides are address-shaped — and a "país"/
        // "ubicación" field is exactly that pattern. Starting the field
        // `readOnly` keeps Chrome from treating it as an autofill target at
        // all; flipping it back to editable on focus (before the user can
        // type anything) is the standard workaround for this.
        readOnly
        onFocus={(event) => {
          event.currentTarget.removeAttribute("readonly");
          setIsOpen(true);
        }}
        placeholder={placeholder}
        rightIcon={HiOutlineMagnifyingGlass}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-64 w-max min-w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow dark:border-gray-600 dark:bg-gray-700">
          {results.length === 0 ? (
            <div className="whitespace-nowrap px-4 py-2 text-gray-400">
              {noResultsLabel}
            </div>
          ) : (
            results.map((country) => (
              <button
                key={country}
                type="button"
                onClick={() => selectCountry(country)}
                className="block w-full whitespace-nowrap px-4 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {country}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

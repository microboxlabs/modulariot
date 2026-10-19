"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useParams } from "next/navigation";
import { textInputTheme } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import PhoneInputWithCountry, {
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
  type Value,
} from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";
import es from "react-phone-number-input/locale/es.json";
import PhoneCountrySelect from "./phone-country-select";

// Keyed by this app's supported locales (src/lang/*.json) — falls back to
// English for any other/unrecognized value.
const PHONE_LOCALES: Record<string, typeof en> = { en, es };

type PhoneInputProps = Readonly<{
  id?: string;
  name?: string;
  placeholder?: string;
  value?: Value;
  onChange: (value: Value | undefined) => void;
  onBlur?: () => void;
  /** Pre-selects this country until the user picks a different one or types a number — see react-phone-number-input's `defaultCountry` prop. */
  defaultCountry?: Country;
  /** TextInput size token for the number field. */
  sizing?: "sm" | "md";
  /** Classes for the outer wrapper (country select + number field). */
  className?: string;
  /** Extra classes for the number field itself (e.g. squaring its right
   *  corners when something is attached after it). */
  inputClassName?: string;
  "aria-label"?: string;
}>;

/** Normalizes any stored phone string ("+56 9 1234 5678", "912345678", …) to
 *  the E.164 value this input expects, reading national numbers as
 *  `defaultCountry`. Returns undefined when it can't be parsed. */
export function toE164(raw: string, defaultCountry: Country = "CL"): Value | undefined {
  if (!raw.trim()) return undefined;
  // Already E.164 (including a number still being typed): pass it through
  // untouched so the input doesn't reset mid-typing.
  if (/^\+\d+$/.test(raw)) return raw as Value;
  try {
    return parsePhoneNumber(raw, defaultCountry)?.number;
  } catch {
    return undefined;
  }
}

/** Real per-country validation (libphonenumber) for any stored format. */
export function isValidPhone(raw: string, defaultCountry: Country = "CL"): boolean {
  const value = toE164(raw, defaultCountry);
  return value !== undefined && isValidPhoneNumber(value);
}

// Reuses TextInput's own token set (the ones it applies to its <input> when
// given an `addon`) so this lines up pixel-for-pixel with the rest of the
// form's fields, without pulling in TextInput itself (its wrapper markup
// doesn't compose with a sibling country-select addon).
const PhoneNumberField = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(function PhoneNumberField({ className, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={twMerge(
        textInputTheme.field.input.base,
        textInputTheme.field.input.sizes.md,
        textInputTheme.field.input.colors.gray,
        textInputTheme.field.input.withAddon.on,
        className
      )}
    />
  );
});
PhoneNumberField.displayName = "PhoneNumberField";

// Wraps react-phone-number-input: real E.164 parsing/validation, a
// Flowbite Dropdown for the country code (instead of the library's native
// <select>), and a number field styled to match this form's other
// TextInputs (instead of the library's own stylesheet, which we don't load).
// The number field always shows the full number, calling code included —
// the dropdown addon just shows the selected country's flag.
export default function PhoneInput({
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  defaultCountry,
  sizing = "md",
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: PhoneInputProps) {
  // `useParams` is null outside a route (e.g. tests) — fall back to English.
  const lang = useParams<{ lang: string }>()?.lang ?? "";
  const labels = PHONE_LOCALES[lang] ?? en;

  return (
    <PhoneInputWithCountry
      id={id}
      name={name}
      className={twMerge("relative flex", className)}
      international
      defaultCountry={defaultCountry}
      labels={labels}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      countrySelectComponent={PhoneCountrySelect}
      inputComponent={PhoneNumberField}
      numberInputProps={{
        "aria-label": ariaLabel,
        className: twMerge(textInputTheme.field.input.sizes[sizing], inputClassName),
      }}
    />
  );
}

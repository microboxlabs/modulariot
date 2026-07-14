"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { textInputTheme } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import PhoneInputWithCountry, {
  type Country,
  type Value,
} from "react-phone-number-input";
import es from "react-phone-number-input/locale/es.json";
import PhoneCountrySelect from "./phone-country-select";

type PhoneInputProps = Readonly<{
  id?: string;
  name?: string;
  placeholder?: string;
  value?: Value;
  onChange: (value: Value | undefined) => void;
  onBlur?: () => void;
  /** Pre-selects this country until the user picks a different one or types a number — see react-phone-number-input's `defaultCountry` prop. */
  defaultCountry?: Country;
}>;

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
}: PhoneInputProps) {
  return (
    <PhoneInputWithCountry
      id={id}
      name={name}
      className="flex"
      international
      defaultCountry={defaultCountry}
      labels={es}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      countrySelectComponent={PhoneCountrySelect}
      inputComponent={PhoneNumberField}
    />
  );
}

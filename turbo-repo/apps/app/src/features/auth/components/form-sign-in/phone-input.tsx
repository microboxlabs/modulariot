"use client";

import { TextInput, type TextInputProps } from "flowbite-react";
import type { ChangeEvent } from "react";

// Digits, spaces, parentheses, hyphens and a leading "+" — enough to cover
// international phone formats without pulling in a formatting library.
const DISALLOWED_CHARS = /[^\d+\-() ]/g;

type PhoneInputProps = Omit<TextInputProps, "type" | "inputMode">;

/** TextInput restricted to phone-number characters as the user types. */
export default function PhoneInput({ onChange, ...props }: PhoneInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    e.target.value = e.target.value.replace(DISALLOWED_CHARS, "");
    onChange?.(e);
  }

  return (
    <TextInput
      type="tel"
      inputMode="tel"
      maxLength={20}
      {...props}
      onChange={handleChange}
    />
  );
}

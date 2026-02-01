"use client";

import { Label, TextInput } from "flowbite-react";
import type { TeamSlugInputProps } from "./team-slug-input.types";

// Info circle icon as inline SVG
function InfoIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default function TeamSlugInput({
  label,
  placeholder,
  value,
  onChange,
  error,
}: TeamSlugInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Label htmlFor="team-slug" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
        <InfoIcon className="h-4 w-4 text-gray-400" />
      </div>
      <TextInput
        id="team-slug"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        color={error ? "failure" : undefined}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
      )}
    </div>
  );
}

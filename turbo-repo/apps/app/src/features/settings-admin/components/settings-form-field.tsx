"use client";

import { Label } from "flowbite-react";
import type { ReactNode } from "react";

export interface SettingsFormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}

/**
 * Shared labeled field used by Settings integration modals (WhatsApp, GPS webhooks, …).
 */
export function SettingsFormField({
  id,
  label,
  error,
  children,
}: SettingsFormFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block">
        {label}
      </Label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

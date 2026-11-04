"use client";

import { HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  type BookRole,
  DRIVER_ROLE,
  isDriverRole,
  roleKey,
} from "../control-tower/contact-roles";
import Select from "./ui/select";

/** True when a saved role has no active contact in the book. False while the book loads. */
export function roleMissing(
  value: string | null | undefined,
  roles: readonly BookRole[] | undefined
): boolean {
  if (!roles || !value?.trim() || isDriverRole(value)) return false;
  const found = roles.find((r) => roleKey(r.role) === roleKey(value));
  return !found || found.activeContacts === 0;
}

function roleLabel(r: BookRole, d: I18nRecord): string {
  const n = String(r.activeContacts);
  return r.activeContacts === 1
    ? tr("roleWithOneContact", d, { role: r.role })
    : tr("roleWithContacts", d, { role: r.role, n });
}

/**
 * Picks who a step contacts: the trip's driver or a role of the contact
 * book. A saved role the book no longer has stays selected.
 */
export default function RolePicker({
  value,
  roles,
  label,
  className,
  wrapperClassName,
  disabled,
  d,
  onChange,
}: Readonly<{
  value: string | null;
  /** Undefined while the book loads. */
  roles: readonly BookRole[] | undefined;
  label: string;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  d: I18nRecord;
  onChange: (role: string) => void;
}>) {
  const saved = value ?? "";
  const match = isDriverRole(saved)
    ? DRIVER_ROLE
    : roles?.find((r) => roleKey(r.role) === roleKey(saved))?.role;
  const selected = match ?? saved;
  const unknown = saved.trim() !== "" && match === undefined;
  return (
    <Select
      aria-label={label}
      className={className}
      wrapperClassName={wrapperClassName}
      disabled={disabled}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{tr("rolePick", d)}</option>
      {unknown && <option value={saved}>{saved}</option>}
      <option value={DRIVER_ROLE}>{tr("roleDriver", d)}</option>
      {roles?.map((r) => (
        <option key={r.role} value={r.role}>
          {roleLabel(r, d)}
        </option>
      ))}
    </Select>
  );
}

export function RoleWarning({
  value,
  roles,
  d,
}: Readonly<{
  value: string | null | undefined;
  roles: readonly BookRole[] | undefined;
  d: I18nRecord;
}>) {
  if (!roleMissing(value, roles)) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <HiExclamation className="h-3.5 w-3.5 shrink-0" />
      {tr("roleNoContacts", d)}
    </p>
  );
}

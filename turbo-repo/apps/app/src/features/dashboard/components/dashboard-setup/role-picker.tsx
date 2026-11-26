"use client";

import { Select } from "flowbite-react";
import { SETUP_ROLES, type DashboardRole } from "./setup.types";

function isDashboardRole(value: string): value is DashboardRole {
  return (SETUP_ROLES as readonly string[]).includes(value);
}

/** Dropdown of the four kinds of access; the chosen one's hint as its title. */
export function RolePicker({
  value,
  onChange,
  label,
  t,
}: Readonly<{
  value: DashboardRole;
  onChange: (role: DashboardRole) => void;
  label: string;
  t: (key: string) => string;
}>) {
  return (
    <Select
      sizing="sm"
      aria-label={label}
      title={t(`roleHints.${value}`)}
      value={value}
      onChange={(event) => {
        if (isDashboardRole(event.target.value)) onChange(event.target.value);
      }}
      className="ml-auto w-40 shrink-0"
    >
      {SETUP_ROLES.map((role) => (
        <option key={role} value={role} title={t(`roleHints.${role}`)}>
          {t(`roles.${role}`)}
        </option>
      ))}
    </Select>
  );
}

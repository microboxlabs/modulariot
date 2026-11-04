"use client";

import { HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  type BookRole,
  roleKey,
  type ScopeRoles,
  type StepTarget,
} from "../control-tower/contact-roles";
import type { StepScope } from "./maintainer-api";
import Select from "./ui/select";

/** The roles the target's scope offers; undefined while the book loads, and for the driver. */
export function rolesForScope(
  scope: StepScope,
  roles: ScopeRoles | undefined
): BookRole[] | undefined {
  if (!roles || scope === "DRIVER") return undefined;
  return scope === "TRIP_CARRIER" ? roles.carrier : roles.org;
}

/** True when a saved role has no active contact in its scope. False while the book loads. */
export function roleMissing(
  target: StepTarget | null,
  roles: ScopeRoles | undefined
): boolean {
  if (!target?.role || target.scope === "DRIVER") return false;
  const list = rolesForScope(target.scope, roles);
  if (!list) return false;
  const found = list.find((r) => roleKey(r.role) === roleKey(target.role));
  return !found || found.activeContacts === 0;
}

function roleLabel(r: BookRole, d: I18nRecord): string {
  const n = String(r.activeContacts);
  return r.activeContacts === 1
    ? tr("roleWithOneContact", d, { role: r.role })
    : tr("roleWithContacts", d, { role: r.role, n });
}

function scopeName(scope: StepScope, d: I18nRecord): string {
  if (scope === "DRIVER") return tr("scopeDriver", d);
  if (scope === "TRIP_CARRIER") return tr("scopeCarrier", d);
  return tr("scopeOrg", d);
}

/**
 * Picks who a step contacts: "de" (the trip's driver, the trip's carrier or
 * the organization) and "rol" (a role of the book in that scope, hidden for
 * the driver). A saved role the book no longer has stays selected.
 */
export default function TargetPicker({
  target,
  roles,
  label,
  className,
  error,
  disabled,
  d,
  onChange,
}: Readonly<{
  target: StepTarget | null;
  /** Undefined while the book loads. */
  roles: ScopeRoles | undefined;
  label: string;
  className: string;
  /** Marks both fields, e.g. when the step does not say whom to contact. */
  error?: string;
  disabled?: boolean;
  d: I18nRecord;
  onChange: (target: StepTarget | null) => void;
}>) {
  const scope = target?.scope;
  const list = scope ? rolesForScope(scope, roles) : undefined;
  const saved = target?.role ?? "";
  const match = list?.find((r) => roleKey(r.role) === roleKey(saved))?.role;
  const unknown = saved !== "" && match === undefined;
  return (
    <>
      <Select
        aria-label={tr("stepScope", d, { label })}
        className={`${className} ${error ?? ""}`}
        wrapperClassName="min-w-40"
        disabled={disabled}
        value={scope ?? ""}
        onChange={(e) => {
          const next = e.target.value as StepScope | "";
          if (!next) onChange(null);
          else onChange({ scope: next, role: null });
        }}
      >
        <option value="">{tr("scopePick", d)}</option>
        <optgroup label={tr("roleGroupTrip", d)}>
          {(["DRIVER", "TRIP_CARRIER"] as const).map((s) => (
            <option key={s} value={s}>
              {tr("roleWithHint", d, {
                role: scopeName(s, d),
                hint: tr("scopeHintTrip", d),
              })}
            </option>
          ))}
        </optgroup>
        <optgroup label={tr("roleGroupOrg", d)}>
          <option value="ORG">{scopeName("ORG", d)}</option>
        </optgroup>
      </Select>
      {scope && scope !== "DRIVER" && (
        <Select
          aria-label={tr("stepScopeRole", d, { label })}
          className={`${className} ${scope === "ORG" && !saved ? (error ?? "") : ""}`}
          wrapperClassName="min-w-40 flex-1"
          disabled={disabled}
          value={match ?? saved}
          onChange={(e) =>
            onChange({ scope, role: e.target.value.trim() || null })
          }
        >
          <option value="">
            {scope === "TRIP_CARRIER" ? tr("roleAny", d) : tr("rolePick", d)}
          </option>
          {unknown && <option value={saved}>{saved}</option>}
          {list?.map((r) => (
            <option key={r.role} value={r.role}>
              {roleLabel(r, d)}
            </option>
          ))}
        </Select>
      )}
    </>
  );
}

export function RoleWarning({
  target,
  roles,
  d,
}: Readonly<{
  target: StepTarget | null;
  roles: ScopeRoles | undefined;
  d: I18nRecord;
}>) {
  if (!roleMissing(target, roles)) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <HiExclamation className="h-3.5 w-3.5 shrink-0" />
      {tr("roleNoContacts", d)}
    </p>
  );
}

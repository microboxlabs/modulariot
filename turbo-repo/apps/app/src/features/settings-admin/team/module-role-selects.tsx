"use client";

import { Label, Select } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { groupByModule, labelOf } from "./team-model";
import type { CatalogRole } from "./team.types";

interface ModuleRoleSelectsProps {
  readonly roles: CatalogRole[];
  readonly value: Record<string, string>;
  readonly onChange: (value: Record<string, string>) => void;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly disabled?: boolean;
}

/** One select per module: no access, or one of that module's roles. */
export function ModuleRoleSelects({
  roles,
  value,
  onChange,
  lang,
  d,
  disabled = false,
}: ModuleRoleSelectsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groupByModule(roles).map((group) => {
        const id = `module-role-${group.module}`;
        return (
          <div key={group.module} className="flex flex-col gap-1">
            <Label htmlFor={id}>{group.module}</Label>
            <Select
              id={id}
              sizing="sm"
              disabled={disabled}
              value={value[group.module] ?? ""}
              onChange={(e) =>
                onChange({ ...value, [group.module]: e.target.value })
              }
            >
              <option value="">{tr("moduleNone", d)}</option>
              {group.items.map((role) => (
                <option key={role.key} value={role.key}>
                  {labelOf(role, lang)}
                </option>
              ))}
            </Select>
          </div>
        );
      })}
    </div>
  );
}

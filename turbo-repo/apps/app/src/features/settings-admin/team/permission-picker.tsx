"use client";

import { useState } from "react";
import { Badge, Checkbox, TextInput } from "flowbite-react";
import { HiOutlineSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { moduleTitle } from "./module-access";
import { filterPermissions } from "./team-filters";
import { canGivePermission, groupByModule, labelOf } from "./team-model";
import type { AccessCatalog } from "./team.types";

interface PermissionPickerProps {
  readonly catalog: AccessCatalog;
  readonly selected: ReadonlySet<string>;
  /** The permissions the role had when the form opened; these can always stay or be removed. */
  readonly initial: ReadonlySet<string>;
  readonly can: (permission: string) => boolean;
  readonly disabled: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onChange: (selected: Set<string>) => void;
}

/** Every catalog permission, grouped by module, to tick for a custom role. */
export function PermissionPicker({
  catalog,
  selected,
  initial,
  can,
  disabled,
  lang,
  d,
  onChange,
}: PermissionPickerProps) {
  const [query, setQuery] = useState("");
  const modules = catalog.modules ?? [];
  const groups = groupByModule(filterPermissions(catalog.permissions, query));
  const givable = (key: string) => {
    const permission = catalog.permissions.find((p) => p.key === key);
    return !!permission && canGivePermission(permission, can, initial.has(key));
  };

  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TextInput
          id="custom-role-permission-search"
          sizing="sm"
          icon={HiOutlineSearch}
          className="w-full sm:w-72"
          value={query}
          placeholder={tr("searchPermissions", d)}
          aria-label={tr("searchPermissions", d)}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("customRolePermissionCount", d, { count: String(selected.size) })}
        </span>
      </div>
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        {groups.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("noMatches", d)}
          </p>
        )}
        {groups.map((group) => {
          const title = moduleTitle(group.module, modules, lang, d);
          const keys = group.items.map((p) => p.key).filter(givable);
          const all = keys.length > 0 && keys.every((k) => selected.has(k));
          const groupId = `custom-role-module-${group.module}`;
          return (
            <fieldset
              key={group.module}
              disabled={disabled}
              className="flex flex-col gap-1"
            >
              <legend className="sr-only">{title}</legend>
              <label
                htmlFor={groupId}
                className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
              >
                <Checkbox
                  id={groupId}
                  checked={all}
                  disabled={keys.length === 0}
                  onChange={(e) => toggle(keys, e.target.checked)}
                />
                {title}
              </label>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 pl-6 sm:grid-cols-2">
                {group.items.map((permission) => {
                  const id = `custom-role-permission-${permission.key}`;
                  return (
                    <label
                      key={permission.key}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm text-gray-900 dark:text-white"
                    >
                      <Checkbox
                        id={id}
                        checked={selected.has(permission.key)}
                        disabled={!givable(permission.key)}
                        onChange={(e) =>
                          toggle([permission.key], e.target.checked)
                        }
                      />
                      <span>{labelOf(permission, lang)}</span>
                      {permission.ownerOnly && (
                        <Badge color="gray" size="xs">
                          {tr("ownerOnly", d)}
                        </Badge>
                      )}
                      {permission.explicitOnly && (
                        <Badge color="gray" size="xs">
                          {tr("explicitOnly", d)}
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

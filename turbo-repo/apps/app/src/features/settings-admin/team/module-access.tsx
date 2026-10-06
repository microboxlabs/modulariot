"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, Button, Radio, Spinner } from "flowbite-react";
import type { IconType } from "react-icons";
import {
  HiArrowLeft,
  HiOutlineCheck,
  HiOutlinePhotograph,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineViewGrid,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { labelOf, permissionsByModule, textOf } from "./team-model";
import type { AccessCatalog, CatalogModule, CatalogRole } from "./team.types";

const MODULE_ICONS: Record<string, IconType> = {
  controltower: HiOutlineShieldCheck,
  harness: HiOutlineSparkles,
  content: HiOutlinePhotograph,
};

export const CARD =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

interface DetailShellProps {
  readonly breadcrumbDict: I18nRecord;
  readonly lang: string;
  readonly backHref: string;
  readonly backLabel: string;
  readonly children: ReactNode;
}

/** The frame of a Team detail page: breadcrumb, back link, scrolling body. */
export function DetailShell({
  breadcrumbDict,
  lang,
  backHref,
  backLabel,
  children,
}: DetailShellProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "team"]}
          disableLinks
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto dark:bg-gray-900">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5 px-4 pt-5 pb-10">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <HiArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Meta({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

interface SectionTitleProps {
  readonly title: string;
  readonly help?: string;
  readonly action?: ReactNode;
}

export function SectionTitle({ title, help, action }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {help && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{help}</p>
        )}
      </div>
      {action}
    </div>
  );
}

interface SaveBarProps {
  readonly busy: boolean;
  readonly d: I18nRecord;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}

/** Shown at the bottom of the page while there are unsaved changes. */
export function SaveBar({ busy, d, onDiscard, onSave }: SaveBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {tr("unsavedChanges", d)}
      </span>
      <div className="flex gap-2">
        <Button
          color="alternative"
          size="sm"
          disabled={busy}
          onClick={onDiscard}
        >
          {tr("discard", d)}
        </Button>
        <Button color="blue" size="sm" disabled={busy} onClick={onSave}>
          {busy && <Spinner size="sm" className="mr-2" />}
          {tr("save", d)}
        </Button>
      </div>
    </div>
  );
}

interface ModuleCardProps {
  readonly mod: CatalogModule;
  readonly roles: CatalogRole[];
  readonly catalog: AccessCatalog;
  readonly value: string;
  readonly includedByBase: boolean;
  readonly disabled: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onChange: (roleKey: string) => void;
}

/** One module: what it is for, and its roles to pick from, each with its permissions. */
export function ModuleCard({
  mod,
  roles,
  catalog,
  value,
  includedByBase,
  disabled,
  lang,
  d,
  onChange,
}: ModuleCardProps) {
  const Icon = MODULE_ICONS[mod.key] ?? HiOutlineViewGrid;
  const tile = mod.ai
    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
  const name = textOf(mod.label, lang) || mod.key;
  const options: {
    key: string;
    label: string;
    description: string;
    permissions: string[];
  }[] = [
    {
      key: "",
      label: tr("moduleNone", d),
      description: tr("moduleNoneHelp", d),
      permissions: [],
    },
    ...roles.map((role) => ({
      key: role.key,
      label: labelOf(role, lang),
      description: textOf(role.description, lang),
      // In catalog order, so the lists read the same in every role.
      permissions: catalog.permissions
        .map((p) => p.key)
        .filter((key) => role.permissions.includes(key)),
    })),
  ];
  return (
    <div className={CARD}>
      <div className="flex items-start gap-3 border-b border-gray-100 p-4 dark:border-gray-700">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {name}
            </h3>
            {includedByBase && (
              <Badge color="gray" size="xs">
                {tr("includedByBase", d)}
              </Badge>
            )}
          </div>
          {textOf(mod.description, lang) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {textOf(mod.description, lang)}
            </p>
          )}
        </div>
      </div>
      <fieldset
        className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2"
        disabled={disabled}
      >
        <legend className="sr-only">{name}</legend>
        {options.map((option) => {
          const selected = option.key === value;
          const id = `role-${mod.key}-${option.key || "none"}`;
          return (
            <label
              key={id}
              htmlFor={id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                selected
                  ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-900/10 dark:ring-blue-500"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              } ${disabled ? "cursor-default opacity-90" : ""}`}
            >
              <Radio
                id={id}
                name={`module-${mod.key}`}
                value={option.key}
                checked={selected}
                onChange={() => onChange(option.key)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                )}
                {option.permissions.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {option.permissions.map((key) => (
                      <li
                        key={key}
                        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
                      >
                        <HiOutlineCheck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {labelOf(
                          catalog.permissions.find((p) => p.key === key),
                          lang,
                          key
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

interface EffectivePermissionsProps {
  readonly permissions: Set<string>;
  readonly catalog: AccessCatalog;
  readonly modules: CatalogModule[];
  readonly help: string;
  readonly lang: string;
  readonly d: I18nRecord;
}

export function EffectivePermissions({
  permissions,
  catalog,
  modules,
  help,
  lang,
  d,
}: EffectivePermissionsProps) {
  const title = (key: string) => {
    const mod = modules.find((m) => m.key === key);
    if (mod && textOf(mod.label, lang)) return textOf(mod.label, lang);
    const named = d?.[`permModule_${key}`];
    return typeof named === "string" ? named : key;
  };
  const groups = permissionsByModule(permissions, catalog);
  return (
    <div className={`${CARD} p-4 lg:sticky lg:top-4`}>
      <h2 className="font-semibold text-gray-900 dark:text-white">
        {tr("effectiveTitle", d)}
      </h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{help}</p>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.module}>
            <p className="mb-1 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {title(group.module)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((permission) => (
                <li
                  key={permission.key}
                  className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200"
                >
                  <HiOutlineCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  {labelOf(permission, lang)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

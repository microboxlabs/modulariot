"use client";

import { Fragment } from "react";
import { Badge } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { CustomRolesSection } from "./custom-roles-section";
import { filterPermissions } from "./team-filters";
import { NoMatches } from "./team-members-tab";
import { groupByModule, labelOf, matrixColumns } from "./team-model";
import type { AccessCatalog, BaseRole } from "./team.types";

interface TeamRolesTabProps {
  readonly catalog: AccessCatalog;
  readonly query?: string;
  /** Owner or Admin: may create, edit and delete custom roles. */
  readonly canManageRoles?: boolean;
  readonly can?: (permission: string) => boolean;
  readonly lang: string;
  readonly d: I18nRecord;
}

const NO_PERMISSION = () => false;

/**
 * The organization's custom roles, then a read-only matrix: permissions
 * (grouped by module) × base, module and custom roles.
 */
export function TeamRolesTab({
  catalog,
  query = "",
  canManageRoles = false,
  can = NO_PERMISSION,
  lang,
  d,
}: TeamRolesTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <CustomRolesSection
        catalog={catalog}
        canManage={canManageRoles}
        can={can}
        lang={lang}
        d={d}
      />
      <RolesMatrix catalog={catalog} query={query} lang={lang} d={d} />
    </div>
  );
}

function RolesMatrix({
  catalog,
  query,
  lang,
  d,
}: Pick<TeamRolesTabProps, "catalog" | "lang" | "d"> & {
  readonly query: string;
}) {
  const baseLabels: Record<BaseRole, string> = {
    OWNER: tr("baseOWNER", d),
    ADMIN: tr("baseADMIN", d),
    MEMBER: tr("baseMEMBER", d),
  };
  const columns = matrixColumns(catalog, lang, baseLabels);
  const permissions = filterPermissions(catalog.permissions, query);
  if (catalog.permissions.length > 0 && permissions.length === 0) {
    return <NoMatches d={d} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("rolesHelp", d)}
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                {tr("permission", d)}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-3 text-center text-xs font-medium text-gray-500 ${column.base ? "bg-gray-100 dark:bg-gray-700" : ""}`}
                >
                  {column.label}
                  {column.custom && (
                    <Badge
                      color="purple"
                      size="xs"
                      className="mx-auto mt-1 w-fit"
                    >
                      {tr("customRoleBadge", d)}
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupByModule(permissions).map((group) => (
              <Fragment key={group.module}>
                <tr className="bg-gray-50/60 dark:bg-gray-800/60">
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-2 text-xs font-semibold uppercase text-gray-500"
                  >
                    {group.module}
                  </td>
                </tr>
                {group.items.map((permission) => (
                  <tr
                    key={permission.key}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {labelOf(permission, lang)}
                      {permission.ownerOnly && (
                        <Badge color="gray" className="ml-2 inline-flex">
                          {tr("ownerOnly", d)}
                        </Badge>
                      )}
                      {permission.explicitOnly && (
                        <Badge color="gray" className="ml-2 inline-flex">
                          {tr("explicitOnly", d)}
                        </Badge>
                      )}
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-2 text-center">
                        {column.permissions.has(permission.key) && (
                          <HiCheck
                            className="mx-auto h-4 w-4 text-blue-600"
                            aria-label={column.label}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

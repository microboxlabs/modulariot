"use client";

import { useState } from "react";
import { Alert, Badge, Button } from "flowbite-react";
import { HiOutlinePencil, HiOutlineTrash, HiPlus } from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { CustomRoleFormModal } from "./custom-role-form-modal";
import { CARD, SectionTitle } from "./module-access";
import { deleteCustomRole, refreshTeamData, useCustomRoles } from "./team-api";
import { holderCounts, labelOf, textOf } from "./team-model";
import type { AccessCatalog, CustomRole } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";

interface CustomRolesSectionProps {
  readonly catalog: AccessCatalog;
  /** Owner or Admin: shows create, edit and delete. */
  readonly canManage: boolean;
  readonly can: (permission: string) => boolean;
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Settings › Team › Roles: the organization's custom roles, with who holds each. */
export function CustomRolesSection({
  catalog,
  canManage,
  can,
  lang,
  d,
}: CustomRolesSectionProps) {
  const { data, error: loadError } = useCustomRoles();
  const roles = data ?? [];
  const [editing, setEditing] = useState<CustomRole | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomRole(deleting.id);
      await refreshTeamData();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={tr("customRolesTitle", d)}
    >
      <SectionTitle
        title={tr("customRolesTitle", d)}
        help={tr("customRolesHelp", d)}
        action={
          canManage && (
            <Button color="blue" size="sm" onClick={() => setEditing("new")}>
              <HiPlus className="mr-1.5 h-4 w-4" />
              {tr("customRoleNew", d)}
            </Button>
          )
        }
      />
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loadError && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {!loadError && roles.length === 0 && (
        <div className={`${CARD} p-6 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {canManage
              ? tr("customRolesEmptyManage", d)
              : tr("customRolesEmpty", d)}
          </p>
        </div>
      )}
      {roles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className={HEAD}>{tr("colName", d)}</th>
                <th className={HEAD}>{tr("customRolePermissions", d)}</th>
                <th className={HEAD}>{tr("customRoleHeldBy", d)}</th>
                {canManage && (
                  <th className={HEAD} aria-label={tr("colActions", d)} />
                )}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className={CELL}>
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      {labelOf(role, lang)}
                      <Badge color="purple" size="xs">
                        {tr("customRoleBadge", d)}
                      </Badge>
                    </div>
                    {textOf(role.description, lang) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {textOf(role.description, lang)}
                      </div>
                    )}
                  </td>
                  <td className={`${CELL} text-gray-700 dark:text-gray-200`}>
                    {tr("customRolePermissionCount", d, {
                      count: String(role.permissions.length),
                    })}
                  </td>
                  <td className={`${CELL} text-gray-700 dark:text-gray-200`}>
                    {tr("customRoleHolders", d, holderCounts(role.holders))}
                  </td>
                  {canManage && (
                    <td className={`${CELL} text-right`}>
                      <div className="flex justify-end gap-2">
                        <Button
                          color="alternative"
                          size="xs"
                          onClick={() => setEditing(role)}
                        >
                          <HiOutlinePencil className="mr-1 h-3.5 w-3.5" />
                          {tr("edit", d)}
                        </Button>
                        <Button
                          color="alternative"
                          size="xs"
                          onClick={() => setDeleting(role)}
                        >
                          <HiOutlineTrash className="mr-1 h-3.5 w-3.5" />
                          {tr("delete", d)}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage && (
        <>
          <CustomRoleFormModal
            show={editing !== null}
            role={editing === "new" ? null : editing}
            catalog={catalog}
            can={can}
            lang={lang}
            d={d}
            onClose={() => setEditing(null)}
            onSaved={() => void refreshTeamData()}
          />
          <ConfirmationModal
            isOpen={deleting !== null}
            onClose={() => setDeleting(null)}
            onConfirm={remove}
            isProcessing={busy}
            variant="danger"
            title={tr("customRoleDeleteTitle", d)}
            description={tr("customRoleDeleteBody", d, {
              name: deleting ? labelOf(deleting, lang) : "",
              ...holderCounts(deleting?.holders),
            })}
            confirmLabel={tr("delete", d)}
          />
        </>
      )}
    </section>
  );
}

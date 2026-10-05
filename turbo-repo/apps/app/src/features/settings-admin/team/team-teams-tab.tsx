"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiOutlineKey,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineUsers,
  HiPlus,
} from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { RolesModal } from "./roles-modal";
import { deleteTeam, setTeamRoles, useTeams } from "./team-api";
import { TeamFormModal } from "./team-form-modal";
import { TeamMembersModal } from "./team-members-modal";
import { labelOf, memberLabels } from "./team-model";
import type { CatalogRole, Team, TeamMember } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";

export interface TeamsPermissions {
  /** teams:manage: create, rename, delete and set members. */
  canManage: boolean;
  /** members:update: change the team's roles. */
  canBind: boolean;
}

interface TeamRowProps {
  readonly team: Team;
  readonly members: TeamMember[];
  readonly roles: CatalogRole[];
  readonly allowed: TeamsPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onEdit: (team: Team) => void;
  readonly onMembers: (team: Team) => void;
  readonly onRoles: (team: Team) => void;
  readonly onDelete: (team: Team) => void;
}

function TeamRow({
  team,
  members,
  roles,
  allowed,
  lang,
  d,
  onEdit,
  onMembers,
  onRoles,
  onDelete,
}: TeamRowProps) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className={CELL}>
        <div className="font-medium text-gray-900 dark:text-white">
          {team.name}
        </div>
        {team.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {team.description}
          </div>
        )}
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {team.members.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noMembers", d)}</span>
          )}
          {memberLabels(team.members, members).map((label) => (
            <Badge key={label} color="gray">
              {label}
            </Badge>
          ))}
        </div>
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {team.roles.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noAccess", d)}</span>
          )}
          {team.roles.map((key) => (
            <Badge key={key} color="indigo">
              {labelOf(
                roles.find((r) => r.key === key),
                lang,
                key
              )}
            </Badge>
          ))}
        </div>
      </td>
      <td className={`${CELL} text-right`}>
        <div className="flex justify-end gap-1">
          {allowed.canManage && (
            <Button size="xs" color="alternative" onClick={() => onEdit(team)}>
              <HiOutlinePencil className="mr-1 h-4 w-4" />
              {tr("edit", d)}
            </Button>
          )}
          {allowed.canManage && (
            <Button
              size="xs"
              color="alternative"
              onClick={() => onMembers(team)}
            >
              <HiOutlineUsers className="mr-1 h-4 w-4" />
              {tr("tabMembers", d)}
            </Button>
          )}
          {allowed.canBind && (
            <Button size="xs" color="alternative" onClick={() => onRoles(team)}>
              <HiOutlineKey className="mr-1 h-4 w-4" />
              {tr("tabRoles", d)}
            </Button>
          )}
          {allowed.canManage && (
            <Button size="xs" color="red" onClick={() => onDelete(team)}>
              <HiOutlineTrash className="mr-1 h-4 w-4" />
              {tr("delete", d)}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

interface TeamTeamsTabProps {
  readonly members: TeamMember[];
  readonly roles: CatalogRole[];
  readonly allowed: TeamsPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
}

/** The organization's teams, their members and the roles they hold. */
export function TeamTeamsTab({
  members,
  roles,
  allowed,
  lang,
  d,
}: TeamTeamsTabProps) {
  const teams = useTeams(true);

  const [form, setForm] = useState<{ team: Team | null } | null>(null);
  const [editingMembers, setEditingMembers] = useState<Team | null>(null);
  const [editingRoles, setEditingRoles] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void teams.mutate();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTeam(deleting.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const list = teams.data ?? [];
  // Stable while the modal is open, so a re-render does not reset the form.
  const currentRoles = useMemo(
    () => editingRoles?.roles ?? null,
    [editingRoles]
  );

  return (
    <div className="flex flex-col gap-3">
      {allowed.canManage && (
        <div className="flex justify-end">
          <Button
            color="blue"
            size="sm"
            onClick={() => setForm({ team: null })}
          >
            <HiPlus className="mr-1.5 h-4 w-4" />
            {tr("teamCreate", d)}
          </Button>
        </div>
      )}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {teams.error && <Alert color="failure">{tr("loadFailed", d)}</Alert>}
      {teams.isLoading && <Spinner className="mx-auto" />}
      {teams.data && list.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">
          {tr("noTeams", d)}
        </p>
      )}
      {list.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className={HEAD}>{tr("colName", d)}</th>
                <th className={HEAD}>{tr("tabMembers", d)}</th>
                <th className={HEAD}>{tr("colAccess", d)}</th>
                <th className={`${HEAD} text-right`}>{tr("colActions", d)}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  members={members}
                  roles={roles}
                  allowed={allowed}
                  lang={lang}
                  d={d}
                  onEdit={(t) => setForm({ team: t })}
                  onMembers={setEditingMembers}
                  onRoles={setEditingRoles}
                  onDelete={setDeleting}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeamFormModal
        show={form !== null}
        team={form?.team ?? null}
        onClose={() => setForm(null)}
        onSaved={reload}
        d={d}
      />
      <TeamMembersModal
        team={editingMembers}
        members={members}
        onClose={() => setEditingMembers(null)}
        onSaved={reload}
        d={d}
      />
      <RolesModal
        current={currentRoles}
        title={tr("rolesTitle", d, { name: editingRoles?.name ?? "" })}
        onSave={(selected) => setTeamRoles(editingRoles?.id ?? "", selected)}
        onClose={() => setEditingRoles(null)}
        onSaved={reload}
        roles={roles}
        lang={lang}
        d={d}
      />
      <ConfirmationModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        isProcessing={busy}
        variant="danger"
        title={tr("teamDeleteTitle", d)}
        description={tr("teamDeleteBody", d, { name: deleting?.name ?? "" })}
        confirmLabel={tr("delete", d)}
      />
    </div>
  );
}

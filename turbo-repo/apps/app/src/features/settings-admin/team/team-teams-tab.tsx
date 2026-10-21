"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import { HiOutlineKey, HiOutlineTrash, HiPlus } from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { deleteTeam, useTeams } from "./team-api";
import { TeamFormModal } from "./team-form-modal";
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

/** Members named in a row before the rest are counted. */
const SHOWN_MEMBERS = 3;

interface TeamRowProps {
  readonly team: Team;
  readonly members: TeamMember[];
  readonly roles: CatalogRole[];
  readonly allowed: TeamsPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onDelete: (team: Team) => void;
}

function TeamRow({
  team,
  members,
  roles,
  allowed,
  lang,
  d,
  onDelete,
}: TeamRowProps) {
  const labels = memberLabels(team.members, members);
  const hidden = labels.length - SHOWN_MEMBERS;
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
        <div className="flex flex-wrap items-center gap-1">
          {labels.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noMembers", d)}</span>
          )}
          {labels.slice(0, SHOWN_MEMBERS).map((label) => (
            <Badge key={label} color="gray">
              {label}
            </Badge>
          ))}
          {hidden > 0 && (
            <span className="text-xs text-gray-500">+{hidden}</span>
          )}
        </div>
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {team.roles.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noAccess", d)}</span>
          )}
          {team.roles.map((key) => (
            <Badge key={key} color="gray">
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
          <Button
            size="xs"
            color="alternative"
            className="whitespace-nowrap"
            as={Link}
            href={`/${lang}/users/settings/team/teams/${encodeURIComponent(team.id)}`}
          >
            <HiOutlineKey className="mr-1 h-4 w-4" />
            {allowed.canManage || allowed.canBind
              ? tr("editAccess", d)
              : tr("viewAccess", d)}
          </Button>
          {allowed.canManage && (
            <Button
              size="xs"
              color="alternative"
              className="whitespace-nowrap"
              onClick={() => onDelete(team)}
            >
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

  const [creating, setCreating] = useState(false);
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

  return (
    <div className="flex flex-col gap-3">
      {allowed.canManage && (
        <div className="flex justify-end">
          <Button color="blue" size="sm" onClick={() => setCreating(true)}>
            <HiPlus className="mr-1.5 h-4 w-4" />
            {tr("teamCreate", d)}
          </Button>
        </div>
      )}
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {teams.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
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
                  onDelete={setDeleting}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeamFormModal
        show={creating}
        team={null}
        onClose={() => setCreating(false)}
        onSaved={reload}
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

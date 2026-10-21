"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineUserGroup,
  HiPlus,
} from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  CARD,
  DetailShell,
  EffectivePermissions,
  Meta,
  ModuleCard,
  SaveBar,
  SectionTitle,
} from "./module-access";
import {
  deleteTeam,
  setTeamMembers,
  setTeamRoles,
  useAccessCatalog,
  useMyAccess,
  useTeam,
  useTeams,
} from "./team-api";
import { TeamFormModal } from "./team-form-modal";
import { TeamMembersModal } from "./team-members-modal";
import { formatDate } from "./team-members-tab";
import {
  catalogModules,
  rolePermissions,
  rolesByModule,
  sameRoles,
  selectedRoles,
  sourceKey,
} from "./team-model";
import type { AccessCatalog, Team, TeamMember } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";

interface TeamAccessPageProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly teamId: string;
}

/**
 * Settings › Team › one team: its members, one role per module, and the
 * permissions every member gets through the team.
 */
export default function TeamAccessPage({
  dict,
  lang,
  teamId,
}: TeamAccessPageProps) {
  const d = dict?.team as I18nRecord;
  const router = useRouter();
  const { can } = useMyAccess();
  const teams = useTeams(true);
  const org = useTeam();
  const { data: catalog } = useAccessCatalog();
  const teamsPath = `/${lang}/users/settings/team?tab=teams`;
  const team = teams.data?.find((t) => t.id === teamId);

  return (
    <DetailShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      backHref={teamsPath}
      backLabel={tr("backToTeams", d)}
    >
      {(teams.isLoading || !catalog) && !teams.error && (
        <Spinner className="mx-auto" />
      )}
      {teams.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {teams.data && catalog && !team && (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("teamNotFound", d)}
          </p>
        </div>
      )}
      {team && catalog && (
        <TeamEditor
          key={team.id}
          team={team}
          members={org.data?.members ?? []}
          catalog={catalog}
          can={can}
          lang={lang}
          d={d}
          onChanged={() => teams.mutate()}
          onDeleted={() => {
            void teams.mutate();
            router.push(teamsPath);
          }}
        />
      )}
    </DetailShell>
  );
}

interface TeamEditorProps {
  readonly team: Team;
  readonly members: TeamMember[];
  readonly catalog: AccessCatalog;
  readonly can: (permission: string) => boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onChanged: () => void;
  readonly onDeleted: () => void;
}

function TeamEditor({
  team,
  members,
  catalog,
  can,
  lang,
  d,
  onChanged,
  onDeleted,
}: TeamEditorProps) {
  const canManage = can("teams:manage");
  const canBind = can("members:update");

  const [byModule, setByModule] = useState<Record<string, string>>(() =>
    rolesByModule(team.roles, catalog.roles)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reset = () => setByModule(rolesByModule(team.roles, catalog.roles));
  // Pick up a saved change (or one made elsewhere) once it is reloaded.
  useEffect(reset, [team, catalog]);

  const roles = selectedRoles(byModule);
  const dirty = canBind && !sameRoles(roles, team.roles);
  const modules = useMemo(() => catalogModules(catalog), [catalog]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = (userId: string) =>
    run(() =>
      setTeamMembers(
        team.id,
        team.members.filter((id) => id !== userId)
      )
    );

  const remove = async () => {
    setBusy(true);
    try {
      await deleteTeam(team.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  return (
    <>
      <TeamHeader
        team={team}
        canManage={canManage}
        lang={lang}
        d={d}
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmDelete(true)}
      />
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionTitle
              title={tr("tabMembers", d)}
              help={tr("teamMembersHelp", d)}
              action={
                canManage && (
                  <Button
                    color="alternative"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => setPicking(true)}
                  >
                    <HiPlus className="mr-1.5 h-4 w-4" />
                    {tr("addMembers", d)}
                  </Button>
                )
              }
            />
            <TeamMembersTable
              team={team}
              members={members}
              canManage={canManage}
              busy={busy}
              lang={lang}
              d={d}
              onRemove={removeMember}
            />
          </section>
          <section className="flex flex-col gap-4">
            <SectionTitle
              title={tr("moduleAccessTitle", d)}
              help={tr("teamModuleAccessHelp", d)}
            />
            {modules.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                roles={catalog.roles.filter((r) => r.module === mod.key)}
                catalog={catalog}
                value={byModule[mod.key] ?? ""}
                includedByBase={false}
                disabled={!canBind || busy}
                lang={lang}
                d={d}
                onChange={(key) => setByModule({ ...byModule, [mod.key]: key })}
              />
            ))}
          </section>
        </div>
        <aside className="lg:col-span-1">
          <EffectivePermissions
            permissions={rolePermissions(roles, catalog)}
            catalog={catalog}
            modules={modules}
            help={tr("teamEffectiveHelp", d)}
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      {dirty && (
        <SaveBar
          busy={busy}
          d={d}
          onDiscard={reset}
          onSave={() => run(() => setTeamRoles(team.id, roles))}
        />
      )}
      <TeamFormModal
        show={editing}
        team={team}
        onClose={() => setEditing(false)}
        onSaved={onChanged}
        d={d}
      />
      <TeamMembersModal
        team={picking ? team : null}
        members={members}
        onClose={() => setPicking(false)}
        onSaved={onChanged}
        d={d}
      />
      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        isProcessing={busy}
        variant="danger"
        title={tr("teamDeleteTitle", d)}
        description={tr("teamDeleteBody", d, { name: team.name })}
        confirmLabel={tr("delete", d)}
      />
    </>
  );
}

interface TeamHeaderProps {
  readonly team: Team;
  readonly canManage: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

function TeamHeader({
  team,
  canManage,
  lang,
  d,
  onEdit,
  onDelete,
}: TeamHeaderProps) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <HiOutlineUserGroup className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
              {team.name}
            </h1>
            {team.description && (
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {team.description}
              </p>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button color="alternative" size="sm" onClick={onEdit}>
              <HiOutlinePencil className="mr-1.5 h-4 w-4" />
              {tr("edit", d)}
            </Button>
            <Button color="alternative" size="sm" onClick={onDelete}>
              <HiOutlineTrash className="mr-1.5 h-4 w-4" />
              {tr("delete", d)}
            </Button>
          </div>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3 dark:border-gray-700">
        <Meta label={tr("tabMembers", d)} value={memberCount(team, d)} />
        <Meta
          label={tr("teamCreated", d)}
          value={formatDate(team.createdAt, lang)}
        />
        <Meta
          label={tr("source", d)}
          value={trDynamic(sourceKey(team.source), d)}
        />
      </dl>
    </div>
  );
}

function memberCount(team: Team, d: I18nRecord): string {
  return team.members.length === 1
    ? tr("memberCountOne", d)
    : tr("memberCount", d, { count: String(team.members.length) });
}

interface TeamMembersTableProps {
  readonly team: Team;
  readonly members: TeamMember[];
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onRemove: (userId: string) => void;
}

/** The team's members, laid out like the organization's Members tab. */
function TeamMembersTable({
  team,
  members,
  canManage,
  busy,
  lang,
  d,
  onRemove,
}: TeamMembersTableProps) {
  if (team.members.length === 0) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noTeamMembers", d)}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className={HEAD}>{tr("colName", d)}</th>
            <th className={HEAD}>{tr("colEmail", d)}</th>
            <th className={HEAD}>{tr("colRole", d)}</th>
            <th className={`${HEAD} text-right`}>{tr("colActions", d)}</th>
          </tr>
        </thead>
        <tbody>
          {team.members.map((userId) => {
            const member = members.find((m) => m.userId === userId);
            return (
              <tr
                key={userId}
                className="border-b border-gray-100 last:border-0 dark:border-gray-700"
              >
                <td className={CELL}>
                  <Link
                    href={`/${lang}/users/settings/team/members/${encodeURIComponent(userId)}`}
                    className="font-medium text-gray-900 hover:underline dark:text-white"
                  >
                    {member?.name ?? member?.email ?? userId}
                  </Link>
                </td>
                <td className={`${CELL} text-gray-600 dark:text-gray-300`}>
                  {member?.email}
                </td>
                <td className={CELL}>
                  {member && (
                    <Badge color="gray" className="w-fit">
                      {trDynamic(`base${member.baseRole}`, d)}
                    </Badge>
                  )}
                </td>
                <td className={`${CELL} text-right`}>
                  {canManage && (
                    <Button
                      size="xs"
                      color="alternative"
                      className="ml-auto whitespace-nowrap"
                      disabled={busy}
                      onClick={() => onRemove(userId)}
                    >
                      <HiOutlineTrash className="mr-1 h-4 w-4" />
                      {tr("remove", d)}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

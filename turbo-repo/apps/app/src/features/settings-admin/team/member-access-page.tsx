"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Alert, Badge, Button, Select, Spinner } from "flowbite-react";
import { HiOutlineTrash } from "react-icons/hi";
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
  removeMember,
  setBaseRole,
  setRoles,
  useAccessCatalog,
  useMyAccess,
  useTeam,
} from "./team-api";
import {
  assignableBaseRoles,
  catalogModules,
  effectivePermissions,
  initials,
  rolesByModule,
  sameRoles,
  selectedRoles,
  sourceKey,
} from "./team-model";
import { formatDate } from "./team-members-tab";
import type { AccessCatalog, BaseRole, TeamMember } from "./team.types";

interface MemberAccessPageProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly userId: string;
}

/**
 * Settings › Team › one member: base role, one role per module (with what each
 * module and role is for), and the permissions that result. Modules come from
 * the access catalog, so new modules show up without changes here.
 */
export default function MemberAccessPage({
  dict,
  lang,
  userId,
}: MemberAccessPageProps) {
  const d = dict?.team as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const router = useRouter();
  const { data: session } = useSession();
  const { can } = useMyAccess();
  const team = useTeam();
  const { data: catalog } = useAccessCatalog();

  const member = team.data?.members.find((m) => m.userId === userId);
  const teamPath = `/${lang}/users/settings/team`;

  return (
    <DetailShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      backHref={teamPath}
      backLabel={tr("backToTeam", d)}
    >
      {(team.isLoading || !catalog) && !team.error && (
        <Spinner className="mx-auto" />
      )}
      {team.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {team.data && catalog && !member && (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("memberNotFound", d)}
          </p>
        </div>
      )}
      {team.data && catalog && member && (
        <MemberEditor
          key={member.userId}
          member={member}
          catalog={catalog}
          fromAlfresco={team.data.membershipSource === "ALFRESCO"}
          isMe={!!session?.user?.email && member.email === session.user.email}
          can={can}
          lang={lang}
          d={d}
          onSaved={() => team.mutate()}
          onRemoved={() => {
            void team.mutate();
            router.push(teamPath);
          }}
        />
      )}
    </DetailShell>
  );
}

interface MemberEditorProps {
  readonly member: TeamMember;
  readonly catalog: AccessCatalog;
  readonly fromAlfresco: boolean;
  readonly isMe: boolean;
  readonly can: (permission: string) => boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onSaved: () => void;
  readonly onRemoved: () => void;
}

function MemberEditor({
  member,
  catalog,
  fromAlfresco,
  isMe,
  can,
  lang,
  d,
  onSaved,
  onRemoved,
}: MemberEditorProps) {
  const canUpdate = can("members:update");
  const canManageOwners = can("owners:manage");
  const canRemove = can("members:remove") && !fromAlfresco && !isMe;
  const baseEditable =
    canUpdate && !isMe && (member.baseRole !== "OWNER" || canManageOwners);

  const [base, setBase] = useState<BaseRole>(member.baseRole);
  const [byModule, setByModule] = useState<Record<string, string>>(() =>
    rolesByModule(member.roles, catalog.roles)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const reset = () => {
    setBase(member.baseRole);
    setByModule(rolesByModule(member.roles, catalog.roles));
  };
  // Pick up a saved change (or one made elsewhere) once it is reloaded.
  useEffect(reset, [member, catalog]);

  const roles = selectedRoles(byModule);
  const baseChanged = base !== member.baseRole;
  const rolesChanged = !sameRoles(roles, member.roles);
  const dirty = canUpdate && (baseChanged || rolesChanged);
  const modules = useMemo(() => catalogModules(catalog), [catalog]);
  const fullAccess = base === "OWNER" || base === "ADMIN";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (baseChanged) await setBaseRole(member.userId, base);
      if (rolesChanged) await setRoles(member.userId, roles);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeMember(member.userId);
      setConfirmRemove(false);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
      setConfirmRemove(false);
      setBusy(false);
    }
  };

  return (
    <>
      <MemberHeader
        member={member}
        base={base}
        baseEditable={baseEditable}
        canManageOwners={canManageOwners}
        canRemove={canRemove}
        isMe={isMe}
        lang={lang}
        d={d}
        onBase={setBase}
        onRemove={() => setConfirmRemove(true)}
      />
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2">
          <SectionTitle
            title={tr("moduleAccessTitle", d)}
            help={
              fullAccess ? tr("moduleAccessFull", d) : tr("moduleAccessHelp", d)
            }
          />
          {modules.map((mod) => (
            <ModuleCard
              key={mod.key}
              mod={mod}
              roles={catalog.roles.filter((r) => r.module === mod.key)}
              catalog={catalog}
              value={byModule[mod.key] ?? ""}
              includedByBase={fullAccess}
              disabled={!canUpdate || busy}
              lang={lang}
              d={d}
              onChange={(key) => setByModule({ ...byModule, [mod.key]: key })}
            />
          ))}
        </section>
        <aside className="lg:col-span-1">
          <EffectivePermissions
            permissions={effectivePermissions(base, roles, catalog)}
            catalog={catalog}
            modules={modules}
            help={tr("effectiveHelp", d)}
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      {dirty && <SaveBar busy={busy} d={d} onDiscard={reset} onSave={save} />}
      <ConfirmationModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        title={tr("removeTitle", d)}
        description={tr("removeBody", d, { email: member.email ?? "" })}
        confirmLabel={tr("remove", d)}
        isProcessing={busy}
      />
    </>
  );
}

interface MemberHeaderProps {
  readonly member: TeamMember;
  readonly base: BaseRole;
  readonly baseEditable: boolean;
  readonly canManageOwners: boolean;
  readonly canRemove: boolean;
  readonly isMe: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onBase: (role: BaseRole) => void;
  readonly onRemove: () => void;
}

function MemberHeader({
  member,
  base,
  baseEditable,
  canManageOwners,
  canRemove,
  isMe,
  lang,
  d,
  onBase,
  onRemove,
}: MemberHeaderProps) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
            {initials(member.name, member.email)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                {member.name ?? member.email}
              </h1>
              {isMe && <Badge color="blue">{tr("you", d)}</Badge>}
            </div>
            {member.name && (
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {member.email}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="member-base-role"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {tr("baseRole", d)}
            </label>
            {baseEditable ? (
              <Select
                id="member-base-role"
                sizing="sm"
                className="w-44"
                value={base}
                onChange={(e) => onBase(e.target.value as BaseRole)}
              >
                {assignableBaseRoles(canManageOwners).map((role) => (
                  <option key={role} value={role}>
                    {trDynamic(`base${role}`, d)}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge color="gray" size="sm" className="w-fit">
                {trDynamic(`base${base}`, d)}
              </Badge>
            )}
          </div>
          {canRemove && (
            <Button color="alternative" size="sm" onClick={onRemove}>
              <HiOutlineTrash className="mr-1.5 h-4 w-4" />
              {tr("removeFromTeam", d)}
            </Button>
          )}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3 dark:border-gray-700">
        <Meta
          label={tr("colJoined", d)}
          value={formatDate(member.joinedAt, lang)}
        />
        <Meta
          label={tr("colLastSeen", d)}
          value={formatDate(member.lastSeenAt, lang, tr("never", d))}
        />
        <Meta
          label={tr("source", d)}
          value={trDynamic(sourceKey(member.source), d)}
        />
      </dl>
    </div>
  );
}

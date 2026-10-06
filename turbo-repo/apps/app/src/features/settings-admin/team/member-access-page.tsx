"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Alert, Badge, Button, Radio, Select, Spinner } from "flowbite-react";
import type { IconType } from "react-icons";
import {
  HiArrowLeft,
  HiOutlineCheck,
  HiOutlinePhotograph,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineTrash,
  HiOutlineViewGrid,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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
  labelOf,
  permissionsByModule,
  rolesByModule,
  sameRoles,
  selectedRoles,
  sourceKey,
  textOf,
} from "./team-model";
import { formatDate } from "./team-members-tab";
import type {
  AccessCatalog,
  BaseRole,
  CatalogModule,
  CatalogRole,
  TeamMember,
} from "./team.types";

const MODULE_ICONS: Record<string, IconType> = {
  controltower: HiOutlineShieldCheck,
  harness: HiOutlineSparkles,
  content: HiOutlinePhotograph,
};

const CARD =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

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
            href={teamPath}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <HiArrowLeft className="h-4 w-4" />
            {tr("backToTeam", d)}
          </Link>
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
              isMe={
                !!session?.user?.email && member.email === session.user.email
              }
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
        </div>
      </div>
    </div>
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr("moduleAccessTitle", d)}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {fullAccess
                ? tr("moduleAccessFull", d)
                : tr("moduleAccessHelp", d)}
            </p>
          </div>
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
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      {dirty && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {tr("unsavedChanges", d)}
          </span>
          <div className="flex gap-2">
            <Button
              color="alternative"
              size="sm"
              disabled={busy}
              onClick={reset}
            >
              {tr("discard", d)}
            </Button>
            <Button color="blue" size="sm" disabled={busy} onClick={save}>
              {busy && <Spinner size="sm" className="mr-2" />}
              {tr("save", d)}
            </Button>
          </div>
        </div>
      )}
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

function Meta({
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

function ModuleCard({
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
  readonly lang: string;
  readonly d: I18nRecord;
}

function EffectivePermissions({
  permissions,
  catalog,
  modules,
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
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {tr("effectiveHelp", d)}
      </p>
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

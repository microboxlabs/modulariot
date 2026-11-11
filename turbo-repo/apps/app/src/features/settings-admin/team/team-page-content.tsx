"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Alert, Button, Spinner } from "flowbite-react";
import {
  HiOutlineTemplate,
  HiOutlineUserGroup,
  HiUserAdd,
} from "react-icons/hi";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import FormModal from "@/features/common/components/form-modal/form-modal";
import { TabButtons } from "@/features/common/components/tab-buttons/tab-buttons";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { InviteLinks, type InviteLink } from "./invite-links";
import {
  removeMember,
  resendInvitation,
  revokeInvitation,
  setBaseRole,
  useAccessCatalog,
  useCustomRoleManagement,
  useInvitations,
  useTeamAccess,
  useServiceAccounts,
  useTeam,
  useTeams,
} from "./team-api";
import {
  NO_MEMBER_FILTERS,
  distinctValues,
  filterInvitations,
  filterMembers,
  filterPermissions,
  filterServiceAccounts,
  filterTeams,
  heldRoles,
  type MemberFilters,
} from "./team-filters";
import { TeamInvitationsTab } from "./team-invitations-tab";
import { TeamKeysTab } from "./team-keys-tab";
import { TeamMembersTab } from "./team-members-tab";
import {
  BASE_ROLES,
  canManageCustomRoles,
  inviteLinkOf,
  labelOf,
  teamActions,
} from "./team-model";
import { TeamRolesTab } from "./team-roles-tab";
import { TeamTeamsTab } from "./team-teams-tab";
import {
  TeamMembersToolbar,
  TeamSearchToolbar,
  type FilterOption,
  type MemberFilterOptions,
} from "./team-toolbar";
import type {
  BaseRole,
  CatalogRole,
  Invitation,
  Team,
  TeamMember,
} from "./team.types";

const TABS = ["members", "invitations", "teams", "keys", "roles"] as const;
type Tab = (typeof TABS)[number];

function tabOf(value: string | null): Tab {
  return TABS.find((t) => t === value) ?? "members";
}

type Confirm =
  | { kind: "remove"; member: TeamMember }
  | { kind: "revoke"; invitation: Invitation }
  | null;

interface TeamPageContentProps {
  readonly dict: I18nRecord;
  /** The whole dictionary, for the shared filter badges. */
  readonly rootDict: I18nRecord;
  readonly lang: string;
}

const NO_MEMBERS: TeamMember[] = [];
const NO_TEAMS: Team[] = [];
const NO_ROLES: CatalogRole[] = [];

/** The translation of `prefix + value`, or the value itself when there is none. */
function valueLabel(prefix: string, value: string, d: I18nRecord): string {
  const key = `${prefix}${value}`;
  const label = trDynamic(key, d);
  return label === key ? value : label;
}

function byLabel(a: FilterOption, b: FilterOption) {
  return a.label.localeCompare(b.label);
}

/** The options of the member filters, from the members, the catalog roles and the teams already loaded. */
export function memberFilterOptions(
  members: readonly TeamMember[],
  roles: readonly CatalogRole[],
  teams: readonly Team[],
  lang: string,
  d: I18nRecord
): MemberFilterOptions {
  const roleKeys = [
    ...new Set([...roles.map((r) => r.key), ...heldRoles(members)]),
  ];
  return {
    baseRoles: BASE_ROLES.map((r) => ({ value: r, label: tr(`base${r}`, d) })),
    roles: roleKeys
      .map((key) => ({
        value: key,
        label: labelOf(
          roles.find((r) => r.key === key),
          lang,
          key
        ),
      }))
      .sort(byLabel),
    statuses: distinctValues(members, "status").map((s) => ({
      value: s,
      label: valueLabel("status", s, d),
    })),
    sources: distinctValues(members, "source").map((s) => ({
      value: s,
      label: valueLabel("source", s, d),
    })),
    teams: teams.map((t) => ({ value: t.id, label: t.name })).sort(byLabel),
  };
}

function confirmTexts(confirm: Confirm, d: I18nRecord) {
  if (confirm?.kind === "revoke") {
    return {
      title: tr("revokeTitle", d),
      description: tr("revokeBody", d, { email: confirm.invitation.email }),
      confirmLabel: tr("revoke", d),
    };
  }
  return {
    title: tr("removeTitle", d),
    description: tr("removeBody", d, {
      email: confirm?.kind === "remove" ? (confirm.member.email ?? "") : "",
    }),
    confirmLabel: tr("remove", d),
  };
}

/**
 * Settings › Team: the organization's members, their base role and module
 * roles, pending invitations, and what each role allows. Actions show only
 * when the caller holds the permission the API checks.
 */
export default function TeamPageContent({
  dict,
  rootDict,
  lang,
}: TeamPageContentProps) {
  const d = dict?.team as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const { data: session } = useSession();
  const { access, can } = useTeamAccess();
  const { data: roleManagement } = useCustomRoleManagement();
  const team = useTeam();
  const { canInvite, canEditInvitationEmail, ...allowed } = teamActions(can);
  const teamsAllowed = {
    canManage: can("teams:manage"),
    canBind: allowed.canUpdate,
  };
  const canManageKeys = can("apikeys:manage");

  const invitations = useInvitations(can("members:read"));
  const {
    data: catalog,
    moduleCatalog,
    error: catalogError,
  } = useAccessCatalog();
  const rolesCatalog = catalog ?? (catalogError ? moduleCatalog : undefined);
  const roles = rolesCatalog?.roles ?? NO_ROLES;

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabOf(searchParams.get("tab")));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState<InviteLink[] | null>(null);
  const [memberFilters, setMemberFilters] =
    useState<MemberFilters>(NO_MEMBER_FILTERS);
  const [invitationQuery, setInvitationQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [keyQuery, setKeyQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");

  // Same SWR keys as the Teams and API keys tabs, so these share their requests.
  const teams = useTeams(tab === "members" || tab === "teams");
  const accounts = useServiceAccounts(tab === "keys" && canManageKeys);
  const members = team.data?.members ?? NO_MEMBERS;
  const teamList = teams.data ?? NO_TEAMS;
  const shownMembers = useMemo(
    () => filterMembers(members, memberFilters, teamList),
    [members, memberFilters, teamList]
  );
  const memberOptions = useMemo(
    () => memberFilterOptions(members, roles, teamList, lang, d),
    [members, roles, teamList, lang, d]
  );
  const invitationList = invitations.data ?? [];
  const shownInvitations = filterInvitations(invitationList, invitationQuery);
  const accountList = accounts.data ?? [];

  const filterStrip = () => {
    if (tab === "members" && team.data) {
      return (
        <TeamMembersToolbar
          filters={memberFilters}
          onFiltersChange={setMemberFilters}
          options={memberOptions}
          shown={shownMembers.length}
          total={members.length}
          d={d}
          rootDict={rootDict}
        />
      );
    }
    if (tab === "invitations") {
      return (
        <TeamSearchToolbar
          id="team-invitation-search"
          query={invitationQuery}
          onQuery={setInvitationQuery}
          placeholder={tr("searchInvitations", d)}
          shown={shownInvitations.length}
          total={invitationList.length}
          d={d}
        />
      );
    }
    if (tab === "teams") {
      return (
        <TeamSearchToolbar
          id="team-team-search"
          query={teamQuery}
          onQuery={setTeamQuery}
          placeholder={tr("searchTeams", d)}
          shown={filterTeams(teamList, teamQuery).length}
          total={teamList.length}
          d={d}
        />
      );
    }
    if (tab === "keys" && canManageKeys) {
      return (
        <TeamSearchToolbar
          id="team-key-search"
          query={keyQuery}
          onQuery={setKeyQuery}
          placeholder={tr("searchKeys", d)}
          shown={filterServiceAccounts(accountList, keyQuery).length}
          total={accountList.length}
          d={d}
        />
      );
    }
    if (tab === "roles" && catalog) {
      return (
        <TeamSearchToolbar
          id="team-permission-search"
          query={permissionQuery}
          onQuery={setPermissionQuery}
          placeholder={tr("searchPermissions", d)}
          shown={filterPermissions(catalog.permissions, permissionQuery).length}
          total={catalog.permissions.length}
          d={d}
        />
      );
    }
    return null;
  };

  const reload = () => {
    void team.mutate();
    void invitations.mutate();
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    }
  };

  const onBaseRole = (member: TeamMember, role: BaseRole) =>
    run(() => setBaseRole(member.userId, role));

  const onResend = (invitation: Invitation) =>
    run(async () => {
      const created = await resendInvitation(invitation.id, lang);
      setResent([inviteLinkOf(created, window.location.origin, lang)]);
    });

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    await run(() =>
      confirm.kind === "remove"
        ? removeMember(confirm.member.userId)
        : revokeInvitation(confirm.invitation.id)
    );
    setBusy(false);
    setConfirm(null);
  };

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "team"]}
      icon={HiOutlineUserGroup}
      title={tr("title", d)}
      description={tr("description", d)}
      filters={filterStrip()}
      actions={
        <div className="flex flex-wrap gap-2">
          {canEditInvitationEmail && (
            <Button
              as={Link}
              href={`/${lang}/users/settings/team/invitation-email`}
              color="alternative"
              size="sm"
            >
              <HiOutlineTemplate className="mr-1.5 h-4 w-4" />
              {tr("invitationEmail", d)}
            </Button>
          )}
          {canInvite && (
            <Button
              as={Link}
              href={`/${lang}/users/settings/team/invite`}
              color="blue"
              size="sm"
            >
              <HiUserAdd className="mr-1.5 h-4 w-4" />
              {tr("invite", d)}
            </Button>
          )}
        </div>
      }
    >
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        <TabButtons<Tab>
          pill
          className="max-w-2xl"
          activeTab={tab}
          onTabChange={setTab}
          tabs={[
            { id: "members", label: tr("tabMembers", d) },
            { id: "invitations", label: tr("tabInvitations", d) },
            { id: "teams", label: tr("tabTeams", d) },
            ...(canManageKeys
              ? [{ id: "keys" as const, label: tr("tabKeys", d) }]
              : []),
            { id: "roles", label: tr("tabRoles", d) },
          ]}
        />

        {error && (
          <Alert color="gray" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {(team.error || catalogError) && (
          <Alert color="gray">{tr("loadFailed", d)}</Alert>
        )}
        {team.isLoading && <Spinner className="mx-auto" />}

        {tab === "members" && team.data && (
          <TeamMembersTab
            members={shownMembers}
            total={members.length}
            onClearFilters={() => setMemberFilters(NO_MEMBER_FILTERS)}
            roles={roles}
            me={session?.user?.email ?? undefined}
            allowed={allowed}
            lang={lang}
            d={d}
            onBaseRole={onBaseRole}
            onRemove={(member) => setConfirm({ kind: "remove", member })}
          />
        )}
        {tab === "invitations" && (
          <TeamInvitationsTab
            invitations={shownInvitations}
            total={invitationList.length}
            roles={roles}
            canInvite={canInvite}
            lang={lang}
            d={d}
            onResend={onResend}
            onRevoke={(invitation) =>
              setConfirm({ kind: "revoke", invitation })
            }
          />
        )}
        {tab === "teams" && (
          <TeamTeamsTab
            members={members}
            query={teamQuery}
            roles={roles}
            allowed={teamsAllowed}
            lang={lang}
            d={d}
          />
        )}
        {tab === "keys" && canManageKeys && (
          <TeamKeysTab query={keyQuery} roles={roles} lang={lang} d={d} />
        )}
        {tab === "roles" && rolesCatalog && (
          <TeamRolesTab
            catalog={rolesCatalog}
            query={permissionQuery}
            canManageRoles={
              !!catalog &&
              canManageCustomRoles(access) &&
              roleManagement?.canManage === true
            }
            can={can}
            lang={lang}
            d={d}
          />
        )}
      </div>

      <FormModal
        isOpen={resent !== null}
        onClose={() => setResent(null)}
        title={tr("linksTitle", d)}
        submitLabel={tr("close", d)}
        showCancelButton={false}
        onSubmit={() => setResent(null)}
      >
        <InviteLinks links={resent ?? []} d={d} />
      </FormModal>
      <ConfirmationModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        isProcessing={busy}
        variant="danger"
        {...confirmTexts(confirm, d)}
      />
    </SettingsPageShell>
  );
}

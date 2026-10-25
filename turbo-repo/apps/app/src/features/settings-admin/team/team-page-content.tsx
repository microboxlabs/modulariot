"use client";

import { useState } from "react";
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
import { tr } from "@/features/i18n/tr.service";
import { InviteLinks, type InviteLink } from "./invite-links";
import {
  removeMember,
  resendInvitation,
  revokeInvitation,
  setBaseRole,
  useAccessCatalog,
  useInvitations,
  useMyAccess,
  useTeam,
} from "./team-api";
import { TeamInvitationsTab } from "./team-invitations-tab";
import { TeamKeysTab } from "./team-keys-tab";
import { TeamMembersTab } from "./team-members-tab";
import { inviteLinkOf, teamActions } from "./team-model";
import { TeamRolesTab } from "./team-roles-tab";
import { TeamTeamsTab } from "./team-teams-tab";
import type { BaseRole, Invitation, TeamMember } from "./team.types";

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
  readonly lang: string;
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
export default function TeamPageContent({ dict, lang }: TeamPageContentProps) {
  const d = dict?.team as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const { data: session } = useSession();
  const { can } = useMyAccess();
  const team = useTeam();
  const { canInvite, canEditInvitationEmail, ...allowed } = teamActions(can);
  const teamsAllowed = {
    canManage: can("teams:manage"),
    canBind: allowed.canUpdate,
  };
  const canManageKeys = can("apikeys:manage");

  const invitations = useInvitations(can("members:read"));
  const { data: catalog } = useAccessCatalog();
  const roles = catalog?.roles ?? [];

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabOf(searchParams.get("tab")));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState<InviteLink[] | null>(null);

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
        {team.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
        {team.isLoading && <Spinner className="mx-auto" />}

        {tab === "members" && team.data && (
          <TeamMembersTab
            members={team.data.members}
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
            invitations={invitations.data ?? []}
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
            members={team.data?.members ?? []}
            roles={roles}
            allowed={teamsAllowed}
            lang={lang}
            d={d}
          />
        )}
        {tab === "keys" && canManageKeys && (
          <TeamKeysTab roles={roles} lang={lang} d={d} />
        )}
        {tab === "roles" && catalog && (
          <TeamRolesTab catalog={catalog} lang={lang} d={d} />
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

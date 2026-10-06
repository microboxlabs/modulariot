"use client";

import { useState, type PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import useSWR from "swr";
import { Alert, Button, Spinner } from "flowbite-react";
import { HiOutlineUserGroup } from "react-icons/hi";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getJson } from "../data/json-client";
import { useIsPlatformOwner } from "../platform/use-platform-membership";
import { acceptInvitationById, switchOrganization } from "./team-api";
import type { Invitation } from "./team.types";

interface NoOrganizationGateProps {
  readonly d: I18nRecord;
}

/** True when the signed-in user belongs to no organization: the scopes route answers 403. */
async function hasNoOrganization(url: string): Promise<boolean> {
  const res = await fetch(url);
  return res.status === 403;
}

/** Pages that need no organization: a platform owner creates organizations there. */
const PLATFORM_OWNER_PATHS = [
  "/users/settings/platform",
  "/users/settings/organizations",
];

export function isPlatformOwnerPath(pathname: string): boolean {
  return PLATFORM_OWNER_PATHS.some((path) => pathname.endsWith(path));
}

/**
 * Replaces the page with a "no access yet" screen when the signed-in user
 * belongs to no organization, listing their pending invitations. The
 * invitation link page is always shown, and so are the platform settings
 * pages to a platform owner.
 */
export function NoOrganizationGate({
  d,
  children,
}: PropsWithChildren<NoOrganizationGateProps>) {
  const pathname = usePathname() ?? "";
  const onInvite = pathname.includes("/invite/");
  const { isPlatformOwner } = useIsPlatformOwner();
  const { data: noOrganization } = useSWR(
    onInvite ? null : "/app/api/user/scopes#gate",
    () => hasNoOrganization("/app/api/user/scopes"),
    { revalidateOnFocus: false }
  );
  if (!noOrganization) return <>{children}</>;
  if (isPlatformOwner && isPlatformOwnerPath(pathname)) return <>{children}</>;
  return <NoAccess d={d} />;
}

function NoAccess({ d }: NoOrganizationGateProps) {
  const invitations = useSWR<Invitation[]>("/app/api/me/invitations", getJson);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async (invitation: Invitation) => {
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationById(invitation.id);
      await switchOrganization(invitation.organization).catch(() => undefined);
      globalThis.location.assign("/app");
    } catch {
      setError(tr("acceptFailed", d));
      setBusy(false);
    }
  };

  const pending = (invitations.data ?? []).filter((i) => !i.expired);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-16">
      <div className="flex items-center gap-3">
        <IconTile icon={HiOutlineUserGroup} />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {tr("noAccessTitle", d)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(pending.length ? "noAccessInvited" : "noAccessAsk", d)}
          </p>
        </div>
      </div>
      {error && <Alert color="gray">{error}</Alert>}
      {invitations.isLoading && <Spinner className="mx-auto" />}
      {pending.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="text-sm">
            <p className="font-medium text-gray-900 dark:text-white">
              {invitation.organization}
            </p>
            {invitation.invitedBy && (
              <p className="text-gray-500 dark:text-gray-400">
                {tr("invitedBy", d, { name: invitation.invitedBy })}
              </p>
            )}
          </div>
          <Button
            color="blue"
            size="sm"
            disabled={busy}
            onClick={() => accept(invitation)}
          >
            {tr("acceptInvitation", d)}
          </Button>
        </div>
      ))}
      <div>
        <Button
          color="alternative"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/app" })}
        >
          {tr("signOutOther", d)}
        </Button>
      </div>
    </div>
  );
}

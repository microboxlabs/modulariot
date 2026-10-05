"use client";

import { Badge, Button } from "flowbite-react";
import { HiOutlineMail, HiOutlineXCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { labelOf } from "./team-model";
import { formatDate } from "./team-members-tab";
import type { CatalogRole, Invitation } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";

interface InvitationRowProps {
  readonly invitation: Invitation;
  readonly roles: CatalogRole[];
  readonly canInvite: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onResend: (invitation: Invitation) => void;
  readonly onRevoke: (invitation: Invitation) => void;
}

function InvitationRow({
  invitation,
  roles,
  canInvite,
  lang,
  d,
  onResend,
  onRevoke,
}: InvitationRowProps) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className={`${CELL} font-medium text-gray-900 dark:text-white`}>
        {invitation.email}
      </td>
      <td className={CELL}>
        <Badge color="gray">{tr(`base${invitation.baseRole}`, d)}</Badge>
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {invitation.roles.map((key) => (
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
      <td className={`${CELL} text-gray-500`}>{invitation.invitedBy}</td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(invitation.expiresAt, lang)}
        {invitation.expired && (
          <Badge color="failure" className="ml-2 inline-flex">
            {tr("expired", d)}
          </Badge>
        )}
      </td>
      <td className={`${CELL} text-right`}>
        {canInvite && (
          <div className="flex justify-end gap-1">
            <Button
              size="xs"
              color="alternative"
              onClick={() => onResend(invitation)}
            >
              <HiOutlineMail className="mr-1 h-4 w-4" />
              {tr("resend", d)}
            </Button>
            <Button size="xs" color="red" onClick={() => onRevoke(invitation)}>
              <HiOutlineXCircle className="mr-1 h-4 w-4" />
              {tr("revoke", d)}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

interface TeamInvitationsTabProps {
  readonly invitations: Invitation[];
  readonly roles: CatalogRole[];
  readonly canInvite: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onResend: (invitation: Invitation) => void;
  readonly onRevoke: (invitation: Invitation) => void;
}

export function TeamInvitationsTab(props: TeamInvitationsTabProps) {
  const { invitations, d } = props;
  if (invitations.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500">
        {tr("noInvitations", d)}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className={HEAD}>{tr("colEmail", d)}</th>
            <th className={HEAD}>{tr("colRole", d)}</th>
            <th className={HEAD}>{tr("colAccess", d)}</th>
            <th className={HEAD}>{tr("colInvitedBy", d)}</th>
            <th className={HEAD}>{tr("colExpires", d)}</th>
            <th className={`${HEAD} text-right`}>{tr("colActions", d)}</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              {...props}
              invitation={invitation}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

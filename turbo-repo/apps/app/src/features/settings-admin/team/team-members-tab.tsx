"use client";

import Link from "next/link";
import { Badge, Button, Select } from "flowbite-react";
import { HiOutlineKey, HiOutlineTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { assignableBaseRoles, labelOf } from "./team-model";
import type { BaseRole, CatalogRole, TeamMember } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";

export function formatDate(value: string | null, lang: string, fallback = "") {
  return value ? new Date(value).toLocaleDateString(lang) : fallback;
}

export interface MemberPermissions {
  canUpdate: boolean;
  canRemove: boolean;
  canManageOwners: boolean;
}

interface MemberRowProps {
  readonly member: TeamMember;
  readonly roles: CatalogRole[];
  readonly me: string | undefined;
  readonly allowed: MemberPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onBaseRole: (member: TeamMember, role: BaseRole) => void;
  readonly onRemove: (member: TeamMember) => void;
}

/** The base role select, shown only when the caller may change this member's role. */
function BaseRoleCell({
  member,
  allowed,
  d,
  onBaseRole,
}: Pick<MemberRowProps, "member" | "allowed" | "d" | "onBaseRole">) {
  const touchesOwner = member.baseRole === "OWNER";
  const editable =
    allowed.canUpdate && (!touchesOwner || allowed.canManageOwners);
  if (!editable) {
    return <Badge color="gray">{tr(`base${member.baseRole}`, d)}</Badge>;
  }
  return (
    <Select
      sizing="sm"
      value={member.baseRole}
      aria-label={tr("colRole", d)}
      onChange={(e) => onBaseRole(member, e.target.value as BaseRole)}
    >
      {assignableBaseRoles(allowed.canManageOwners).map((role) => (
        <option key={role} value={role}>
          {tr(`base${role}`, d)}
        </option>
      ))}
    </Select>
  );
}

function MemberRow({
  member,
  roles,
  me,
  allowed,
  lang,
  d,
  onBaseRole,
  onRemove,
}: MemberRowProps) {
  const isMe = me !== undefined && member.email === me;
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className={CELL}>
        <span className="font-medium text-gray-900 dark:text-white">
          {member.name ?? member.email}
        </span>
        {isMe && (
          <Badge color="blue" className="ml-2 inline-flex">
            {tr("you", d)}
          </Badge>
        )}
      </td>
      <td className={`${CELL} text-gray-600 dark:text-gray-300`}>
        {member.email}
      </td>
      <td className={CELL}>
        <BaseRoleCell
          member={member}
          allowed={allowed}
          d={d}
          onBaseRole={onBaseRole}
        />
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {member.roles.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noAccess", d)}</span>
          )}
          {member.roles.map((key) => (
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
      <td className={`${CELL} text-gray-500`}>
        {formatDate(member.joinedAt, lang)}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(member.lastSeenAt, lang, tr("never", d))}
      </td>
      <td className={`${CELL} text-right`}>
        <div className="flex justify-end gap-1">
          <Button
            size="xs"
            color="alternative"
            as={Link}
            href={`/${lang}/users/settings/team/members/${encodeURIComponent(member.userId)}`}
          >
            <HiOutlineKey className="mr-1 h-4 w-4" />
            {allowed.canUpdate ? tr("editAccess", d) : tr("viewAccess", d)}
          </Button>
          {allowed.canRemove && !isMe && (
            <Button
              size="xs"
              color="alternative"
              onClick={() => onRemove(member)}
            >
              <HiOutlineTrash className="mr-1 h-4 w-4" />
              {tr("remove", d)}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

interface TeamMembersTabProps {
  readonly members: TeamMember[];
  readonly roles: CatalogRole[];
  readonly me: string | undefined;
  readonly allowed: MemberPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onBaseRole: (member: TeamMember, role: BaseRole) => void;
  readonly onRemove: (member: TeamMember) => void;
}

export function TeamMembersTab(props: TeamMembersTabProps) {
  const { members, d } = props;
  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500">
        {tr("noMembers", d)}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className={HEAD}>{tr("colName", d)}</th>
            <th className={HEAD}>{tr("colEmail", d)}</th>
            <th className={HEAD}>{tr("colRole", d)}</th>
            <th className={HEAD}>{tr("colAccess", d)}</th>
            <th className={HEAD}>{tr("colJoined", d)}</th>
            <th className={HEAD}>{tr("colLastSeen", d)}</th>
            <th className={`${HEAD} text-right`}>{tr("colActions", d)}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow key={member.userId} {...props} member={member} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

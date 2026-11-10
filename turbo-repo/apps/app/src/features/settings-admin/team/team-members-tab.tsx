"use client";

import Link from "next/link";
import { Badge, Button, Select } from "flowbite-react";
import { HiOutlineKey, HiOutlineTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { BASE_ROLES, labelOf, NON_OWNER_ROLES } from "./team-model";
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
      className="min-w-40"
      value={member.baseRole}
      aria-label={tr("colRole", d)}
      onChange={(e) => onBaseRole(member, e.target.value as BaseRole)}
    >
      {(allowed.canManageOwners ? BASE_ROLES : NON_OWNER_ROLES).map((role) => (
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
            className="whitespace-nowrap"
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
              className="whitespace-nowrap"
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
  /** The members that pass the filters. */
  readonly members: TeamMember[];
  /** All members, before the filters. Defaults to the shown count. */
  readonly total?: number;
  readonly onClearFilters?: () => void;
  readonly roles: CatalogRole[];
  readonly me: string | undefined;
  readonly allowed: MemberPermissions;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onBaseRole: (member: TeamMember, role: BaseRole) => void;
  readonly onRemove: (member: TeamMember) => void;
}

/** The empty state of a filtered list that had rows before the filters. */
export function NoMatches({
  d,
  onClear,
}: Readonly<{ d: I18nRecord; onClear?: () => void }>) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm text-gray-500">
      <p>{tr("noMatches", d)}</p>
      {onClear && (
        <Button size="xs" color="light" onClick={onClear}>
          {tr("clearFilters", d)}
        </Button>
      )}
    </div>
  );
}

export function TeamMembersTab(props: TeamMembersTabProps) {
  const { members, total = members.length, onClearFilters, d } = props;
  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500">
        {tr("noMembers", d)}
      </p>
    );
  }
  if (members.length === 0) {
    return <NoMatches d={d} onClear={onClearFilters} />;
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
            <MemberRow
              key={member.userId}
              roles={props.roles}
              me={props.me}
              allowed={props.allowed}
              lang={props.lang}
              d={d}
              onBaseRole={props.onBaseRole}
              onRemove={props.onRemove}
              member={member}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  HiArrowLeft,
  HiCheck,
  HiOutlineSearch,
  HiUserAdd,
} from "react-icons/hi";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { OrgMember } from "../types";
import IdField from "./id-field";
import {
  COMPANY_ID_TYPES,
  displayId,
  guessCompanyIdType,
  PERSON_ID_TYPES,
  type IdType,
} from "./tax-id";
import type { CompanyOption } from "./store";
import ContactOrganizationSection from "./contact-organization-section";
import { normalizeLabel } from "./taxonomy-store";

export const SECTION_INPUT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white";
/** Shared by the "outside the organization" and "back to the list" buttons. */
const SWITCH_BUTTON_CLASS =
  "flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white";
const LABEL_CLASS = "text-xs font-medium text-gray-600 dark:text-gray-300";

export type PersonSource = "org" | "external";

export interface PersonDraft {
  source: PersonSource;
  /** The picked organization member (source "org"). */
  orgMemberId?: string;
  /** Full name: the member's name, or typed for an external contact. */
  name: string;
  /** Only typed for an external contact: the document's number, and its type. */
  rut: string;
  rutType?: IdType;
}

/** The member's name; the email when the directory has none. */
const NO_IDS: ReadonlySet<string> = new Set();

export function memberName(member: OrgMember): string {
  const full = [member.firstName, member.lastName]
    .filter((part) => part?.trim())
    .join(" ");
  return member.displayName?.trim() || full || member.email;
}

function MemberRow({
  member,
  selected,
  takenLabel,
  onPick,
}: Readonly<{
  member: OrgMember;
  selected: boolean;
  /** Set when another contact of the book is this member: the row can't be picked. */
  takenLabel?: string;
  onPick: () => void;
}>) {
  let tone = "hover:bg-gray-50 dark:hover:bg-gray-700/50";
  if (selected) tone = "bg-blue-50 dark:bg-blue-500/10";
  else if (takenLabel) tone = "cursor-not-allowed opacity-60";
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        disabled={Boolean(takenLabel)}
        onClick={onPick}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${tone}`}
      >
        <InitialIdentifier name={memberName(member)} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
            {memberName(member)}
          </span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {member.email}
          </span>
        </span>
        {takenLabel && (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {takenLabel}
          </span>
        )}
        {selected && (
          <HiCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        )}
      </button>
    </li>
  );
}

function OrgMemberList({
  members,
  isLoading,
  selectedId,
  takenIds,
  onPick,
  d,
}: Readonly<{
  members: readonly OrgMember[];
  isLoading: boolean;
  selectedId?: string;
  takenIds: ReadonlySet<string>;
  onPick: (m: OrgMember) => void;
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  const key = normalizeLabel(query);
  const shown = members.filter(
    (m) => !key || normalizeLabel(`${memberName(m)} ${m.email}`).includes(key)
  );
  let emptyText = "";
  if (isLoading) emptyText = tr("orgLoading", d);
  else if (shown.length === 0) emptyText = tr("orgEmpty", d);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          className={`${SECTION_INPUT_CLASS} pl-9`}
          placeholder={tr("orgSearchPlaceholder", d)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {emptyText && (
          <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {emptyText}
          </p>
        )}
        <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
          {shown.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              selected={selectedId === m.id}
              takenLabel={
                takenIds.has(m.id) ? tr("memberInBook", d) : undefined
              }
              onPick={() => onPick(m)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Persona card — by default, the active organization's people to pick from
 * (with a search). "O ingresa un contacto fuera de la organización" switches
 * to typing an outside person's full name, RUT and organization.
 */
export default function ContactPersonSection({
  value,
  onChange,
  members,
  membersLoading,
  rutInvalid,
  organization,
  onOrganizationChange,
  companyRut,
  companyRutType = "RUT",
  onCompanyRutChange,
  companyRutInvalid,
  organizations,
  takenMemberIds = NO_IDS,
  d,
}: Readonly<{
  value: PersonDraft;
  onChange: (next: PersonDraft) => void;
  members: readonly OrgMember[];
  membersLoading: boolean;
  rutInvalid: boolean;
  /** The outside contact's organization (API `company`); "" for none. */
  organization: string;
  onOrganizationChange: (next: string) => void;
  /** The organization's tax id; "" for none. */
  companyRut: string;
  companyRutType?: IdType;
  onCompanyRutChange: (next: string, type: IdType) => void;
  companyRutInvalid: boolean;
  /** The companies already used in the book, offered to pick from. */
  organizations: readonly CompanyOption[];
  /** Members other contacts of the book were created from. */
  takenMemberIds?: ReadonlySet<string>;
  d: I18nRecord;
}>) {
  if (value.source === "org") {
    return (
      <div className="flex flex-col gap-3">
        <OrgMemberList
          members={members}
          isLoading={membersLoading}
          selectedId={value.orgMemberId}
          takenIds={takenMemberIds}
          onPick={(m) =>
            onChange({ ...value, orgMemberId: m.id, name: memberName(m) })
          }
          d={d}
        />
        <button
          type="button"
          onClick={() => onChange({ source: "external", name: "", rut: "" })}
          className={SWITCH_BUTTON_CLASS}
        >
          <HiUserAdd className="h-4 w-4" />
          {tr("externalContactButton", d)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{tr("fullNameLabel", d)}</span>
        <input
          className={SECTION_INPUT_CLASS}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <IdField
        label={tr("rutLabel", d)}
        types={PERSON_ID_TYPES}
        type={value.rutType ?? "RUT"}
        value={value.rut}
        invalid={rutInvalid}
        onChange={(rutType, rut) => onChange({ ...value, rut, rutType })}
        d={d}
      />
      <div className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{tr("companyLabel", d)}</span>
        <ContactOrganizationSection
          value={organization}
          onChange={(company, rut, taxIdType) => {
            onOrganizationChange(company);
            const type = taxIdType ?? (rut ? guessCompanyIdType(rut) : "RUT");
            onCompanyRutChange(rut ? displayId(type, rut) : "", type);
          }}
          organizations={organizations}
          d={d}
        />
      </div>
      <IdField
        label={tr("companyRutLabel", d)}
        types={COMPANY_ID_TYPES}
        type={companyRutType}
        value={companyRut}
        invalid={companyRutInvalid}
        onChange={(type, rut) => onCompanyRutChange(rut, type)}
        d={d}
      />
      <button
        type="button"
        onClick={() => onChange({ source: "org", name: "", rut: "" })}
        className={SWITCH_BUTTON_CLASS}
      >
        <HiArrowLeft className="h-4 w-4" />
        {tr("backToOrgList", d)}
      </button>
    </div>
  );
}

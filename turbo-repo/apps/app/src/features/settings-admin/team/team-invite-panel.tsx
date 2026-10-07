"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { Alert, Button, Label, Select, TextInput } from "flowbite-react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { InviteLinks, type InviteLink } from "./invite-links";
import { ModuleRoleSelects } from "./module-role-selects";
import { invite } from "./team-api";
import {
  BASE_ROLES,
  invalidEmails,
  inviteGroups,
  inviteLinkOf,
  NON_OWNER_ROLES,
  parseEmails,
  repeatedEmails,
  selectedRoles,
  type InviteRow,
} from "./team-model";
import type { BaseRole, CatalogRole } from "./team.types";

const EXPIRY_DAYS = [7, 30, 90];

type Row = InviteRow & { id: number };

interface TeamInvitePanelProps {
  readonly onClose: () => void;
  readonly onInvited: () => void;
  readonly roles: CatalogRole[];
  readonly canManageOwners: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
}

/**
 * Inline invite form above the team tabs: one row per email with its role.
 * After sending, it lists each invitation link to copy.
 */
export function TeamInvitePanel({
  onClose,
  onInvited,
  roles,
  canManageOwners,
  lang,
  d,
}: TeamInvitePanelProps) {
  const nextId = useRef(1);
  const row = (email = "", baseRole: BaseRole = "MEMBER"): Row => ({
    id: nextId.current++,
    email,
    baseRole,
  });
  const [rows, setRows] = useState<Row[]>(() => [row()]);
  // The row whose input takes focus when it mounts.
  const [focusId, setFocusId] = useState(rows[0].id);
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [done, setDone] = useState(false);

  const roleOptions = canManageOwners ? BASE_ROLES : NON_OWNER_ROLES;
  const groups = inviteGroups(rows);
  const count = groups.reduce((n, g) => n + g.emails.length, 0);
  const anyMember = rows.some((r) => r.baseRole === "MEMBER");

  const update = (index: number, change: Partial<InviteRow>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const addRow = () => {
    const added = row("", rows.at(-1)?.baseRole);
    setRows([...rows, added]);
    setFocusId(added.id);
  };

  // A pasted list becomes one row per email, all with this row's role. What
  // the row already held is kept as the first of them.
  const onPaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (parseEmails(pastedText).length < 2) return;
    e.preventDefault();
    const current = rows[index];
    const pasted = parseEmails(`${current.email} ${pastedText}`).map((email) =>
      row(email, current.baseRole)
    );
    setRows([...rows.slice(0, index), ...pasted, ...rows.slice(index + 1)]);
    setFocusId(pasted[pasted.length - 1].id);
  };

  const validationError = (): string | null => {
    const all = groups.flatMap((g) => g.emails);
    if (all.length === 0) return tr("emailsMissing", d);
    const invalid = invalidEmails(all);
    if (invalid.length > 0) {
      return tr("emailsInvalid", d, { emails: invalid.join(", ") });
    }
    const repeated = repeatedEmails(rows);
    if (repeated.length > 0) {
      return tr("emailsRepeated", d, { emails: repeated.join(", ") });
    }
    return null;
  };

  const submit = async () => {
    if (busy) return;
    setChecked(true);
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const sent: InviteLink[] = [];
    let failedAt = groups.length;
    for (const [i, group] of groups.entries()) {
      try {
        const created = await invite({
          lang,
          emails: group.emails,
          baseRole: group.baseRole,
          roles: group.baseRole === "MEMBER" ? selectedRoles(byModule) : [],
          expiresInDays: days,
        });
        sent.push(
          ...created.map((c) => inviteLinkOf(c, window.location.origin, lang))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : tr("saveFailed", d));
        failedAt = i;
        break;
      }
    }
    setBusy(false);
    setLinks((previous) => [...previous, ...sent]);
    if (sent.length > 0) onInvited();
    if (failedAt === groups.length) {
      setDone(true);
      return;
    }
    // Keep only what was not sent, so a retry does not invite twice.
    setRows(
      groups
        .slice(failedAt)
        .flatMap((g) => g.emails.map((email) => row(email, g.baseRole)))
    );
  };

  const inviteMore = () => {
    const first = row();
    setRows([first]);
    setFocusId(first.id);
    setLinks([]);
    setChecked(false);
    setDone(false);
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {done ? tr("linksTitle", d) : tr("inviteTitle", d)}
          </h2>
          {!done && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("inviteSubtitle", d)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={tr("close", d)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <HiX className="h-5 w-5" />
        </button>
      </div>

      {links.length > 0 && <InviteLinks links={links} d={d} />}

      {done ? (
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button color="alternative" size="sm" onClick={inviteMore}>
            {tr("inviteMore", d)}
          </Button>
          <Button color="blue" size="sm" onClick={onClose}>
            {tr("close", d)}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-[1fr_12rem_2.25rem] gap-2 sm:grid">
              <Label>{tr("colEmail", d)}</Label>
              <Label>{tr("baseRole", d)}</Label>
            </div>
            {rows.map((current, index) => {
              const invalid =
                checked &&
                current.email.trim() !== "" &&
                invalidEmails(parseEmails(current.email)).length > 0;
              return (
                <div
                  key={current.id}
                  className="grid grid-cols-[1fr_2.25rem] gap-2 sm:grid-cols-[1fr_12rem_2.25rem]"
                >
                  <TextInput
                    type="email"
                    sizing="sm"
                    autoFocus={current.id === focusId}
                    aria-label={tr("colEmail", d)}
                    placeholder={tr("emailPlaceholder", d)}
                    color={invalid ? "failure" : undefined}
                    value={current.email}
                    onChange={(e) => update(index, { email: e.target.value })}
                    onPaste={(e) => onPaste(index, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        void submit();
                      }
                    }}
                  />
                  <Select
                    sizing="sm"
                    aria-label={tr("baseRole", d)}
                    className="order-last col-span-2 sm:order-none sm:col-span-1"
                    value={current.baseRole}
                    onChange={(e) =>
                      update(index, { baseRole: e.target.value as BaseRole })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {tr(`base${role}`, d)}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    disabled={rows.length === 1}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    aria-label={tr("removeRow", d)}
                    className="flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:invisible dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    <HiX className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addRow}
              className="flex w-fit items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              <HiPlus className="h-4 w-4" />
              {tr("addAnother", d)}
            </button>
          </div>

          {roles.length > 0 && anyMember && (
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {tr("moduleAccess", d)}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr("moduleAccessMembers", d)}
                </p>
              </div>
              <ModuleRoleSelects
                roles={roles}
                value={byModule}
                onChange={setByModule}
                lang={lang}
                d={d}
              />
            </div>
          )}

          {error && <Alert color="failure">{error}</Alert>}

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Label htmlFor="invite-expiry" className="whitespace-nowrap">
                {tr("expiresIn", d)}
              </Label>
              <Select
                id="invite-expiry"
                sizing="sm"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {EXPIRY_DAYS.map((n) => (
                  <option key={n} value={n}>
                    {tr("daysOption", d, { count: String(n) })}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                color="alternative"
                size="sm"
                disabled={busy}
                onClick={onClose}
              >
                {tr("cancel", d)}
              </Button>
              <Button
                color="blue"
                size="sm"
                disabled={busy || count === 0}
                onClick={() => void submit()}
              >
                {count > 1
                  ? tr("sendCount", d, { count: String(count) })
                  : tr("send", d)}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

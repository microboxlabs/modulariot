"use client";

import { useEffect, useState } from "react";
import { Label, Select, Textarea, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { InviteLinks, type InviteLink } from "./invite-links";
import { ModuleRoleSelects } from "./module-role-selects";
import { invite } from "./team-api";
import {
  assignableBaseRoles,
  invalidEmails,
  inviteLink,
  parseEmails,
  selectedRoles,
} from "./team-model";
import type { BaseRole, CatalogRole } from "./team.types";

interface TeamInviteModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onInvited: () => void;
  readonly roles: CatalogRole[];
  readonly canManageOwners: boolean;
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Invite form; after sending, the same modal shows each link to copy. */
export function TeamInviteModal({
  show,
  onClose,
  onInvited,
  roles,
  canManageOwners,
  lang,
  d,
}: TeamInviteModalProps) {
  const [emailsText, setEmailsText] = useState("");
  const [baseRole, setBaseRole] = useState<BaseRole>("MEMBER");
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [links, setLinks] = useState<InviteLink[] | null>(null);

  useEffect(() => {
    setEmailsText("");
    setBaseRole("MEMBER");
    setByModule({});
    setDays(30);
    setError(null);
    setLinks(null);
  }, [show]);

  const submit = async () => {
    if (links) {
      onClose();
      return;
    }
    const emails = parseEmails(emailsText);
    const invalid = invalidEmails(emails);
    if (emails.length === 0 || invalid.length > 0) {
      setError(
        new Error(tr("emailsInvalid", d, { emails: invalid.join(", ") }))
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await invite({
        emails,
        baseRole,
        roles: selectedRoles(byModule),
        expiresInDays: days,
      });
      setLinks(
        created.map((c) => ({
          email: c.invitation.email,
          url: inviteLink(window.location.origin, lang, c.token),
        }))
      );
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(tr("saveFailed", d)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={links ? tr("linksTitle", d) : tr("inviteTitle", d)}
      subtitle={links ? undefined : tr("inviteSubtitle", d)}
      submitLabel={links ? tr("close", d) : tr("send", d)}
      showCancelButton={!links}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
      size="2xl"
    >
      {links ? (
        <InviteLinks links={links} d={d} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-emails">{tr("emails", d)}</Label>
            <Textarea
              id="invite-emails"
              rows={3}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="ana@empresa.cl, bo@empresa.cl"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("emailsHint", d)}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="invite-base-role">{tr("baseRole", d)}</Label>
              <Select
                id="invite-base-role"
                sizing="sm"
                value={baseRole}
                onChange={(e) => setBaseRole(e.target.value as BaseRole)}
              >
                {assignableBaseRoles(canManageOwners).map((role) => (
                  <option key={role} value={role}>
                    {tr(`base${role}`, d)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="invite-days">{tr("expiresInDays", d)}</Label>
              <TextInput
                id="invite-days"
                type="number"
                sizing="sm"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          {roles.length > 0 && baseRole === "MEMBER" && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {tr("moduleAccess", d)}
              </span>
              <ModuleRoleSelects
                roles={roles}
                value={byModule}
                onChange={setByModule}
                lang={lang}
                d={d}
              />
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
}

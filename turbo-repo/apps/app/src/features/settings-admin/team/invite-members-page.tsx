"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Label,
  Select,
  Spinner,
  Textarea,
} from "flowbite-react";
import { HiUserAdd } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { InviteLinks, type InviteLink } from "./invite-links";
import {
  CARD,
  DetailShell,
  EffectivePermissions,
  ModuleCard,
  SectionTitle,
} from "./module-access";
import { invite, useAccessCatalog, useMyAccess, useTeam } from "./team-api";
import {
  BASE_ROLES,
  catalogModules,
  effectivePermissions,
  invalidEmails,
  inviteBatches,
  inviteLinkOf,
  NON_OWNER_ROLES,
  parseEmails,
  selectedRoles,
} from "./team-model";
import type { AccessCatalog, BaseRole } from "./team.types";

const EXPIRY_DAYS = [7, 30, 90];

interface InviteMembersPageProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Team › invite: the emails, their base role and one role per
 * module, laid out like a member's access page. After sending it shows each
 * invitation link.
 */
export default function InviteMembersPage({
  dict,
  lang,
}: InviteMembersPageProps) {
  const d = dict?.team as I18nRecord;
  const { can } = useMyAccess();
  const team = useTeam();
  const { data: catalog, error } = useAccessCatalog();
  const teamPath = `/${lang}/users/settings/team`;
  const [links, setLinks] = useState<InviteLink[] | null>(null);
  const [formKey, setFormKey] = useState(0);

  const fromAlfresco = team.data?.membershipSource === "ALFRESCO";
  const allowed =
    can("members:invite") && team.data?.membershipSource === "NATIVE";
  const loading = (!catalog && !error) || team.isLoading;

  return (
    <DetailShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      backHref={teamPath}
      backLabel={tr("backToTeam", d)}
    >
      {loading && <Spinner className="mx-auto" />}
      {(error || team.error) && (
        <Alert color="gray">{tr("loadFailed", d)}</Alert>
      )}
      {!loading && team.data && !allowed && (
        <Alert color="gray">
          {fromAlfresco ? tr("alfrescoNote", d) : tr("inviteNotAllowed", d)}
        </Alert>
      )}
      {catalog && allowed && !links && (
        <InviteForm
          key={formKey}
          catalog={catalog}
          canManageOwners={can("owners:manage")}
          teamPath={teamPath}
          lang={lang}
          d={d}
          onSent={(sent) => {
            setLinks(sent);
            void team.mutate();
          }}
        />
      )}
      {links && (
        <div
          className={`${CARD} mx-auto flex w-full max-w-2xl flex-col gap-4 p-6`}
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {tr("linksTitle", d)}
          </h1>
          <InviteLinks links={links} d={d} />
          <div className="flex justify-end gap-2">
            <Button
              color="alternative"
              size="sm"
              onClick={() => {
                setLinks(null);
                setFormKey(formKey + 1);
              }}
            >
              {tr("inviteMore", d)}
            </Button>
            <Button
              as={Link}
              href={`${teamPath}?tab=invitations`}
              color="blue"
              size="sm"
            >
              {tr("backToTeam", d)}
            </Button>
          </div>
        </div>
      )}
    </DetailShell>
  );
}

interface InviteFormProps {
  readonly catalog: AccessCatalog;
  readonly canManageOwners: boolean;
  readonly teamPath: string;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onSent: (links: InviteLink[]) => void;
}

function InviteForm({
  catalog,
  canManageOwners,
  teamPath,
  lang,
  d,
  onSent,
}: InviteFormProps) {
  const [emailsText, setEmailsText] = useState("");
  const [base, setBase] = useState<BaseRole>("MEMBER");
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteLink[]>([]);

  const emails = parseEmails(emailsText);
  const invalid = invalidEmails(emails);
  const roles = selectedRoles(byModule);
  const modules = useMemo(() => catalogModules(catalog), [catalog]);
  const fullAccess = base === "OWNER" || base === "ADMIN";

  const submit = async () => {
    if (emails.length === 0) {
      setError(tr("emailsMissing", d));
      return;
    }
    if (invalid.length > 0) {
      setError(tr("emailsInvalid", d, { emails: invalid.join(", ") }));
      return;
    }
    setBusy(true);
    setError(null);
    const done = [...sent];
    let pending: string[] = [];
    for (const batch of inviteBatches(emails)) {
      if (pending.length > 0) {
        pending.push(...batch);
        continue;
      }
      try {
        const created = await invite({
          lang,
          emails: batch,
          baseRole: base,
          roles: fullAccess ? [] : roles,
          expiresInDays: days,
        });
        done.push(
          ...created.map((c) => inviteLinkOf(c, window.location.origin, lang))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : tr("saveFailed", d));
        pending = [...batch];
      }
    }
    setBusy(false);
    if (pending.length === 0) {
      onSent(done);
      return;
    }
    // Keep only the emails not invited yet, so a retry does not invite twice.
    setSent(done);
    setEmailsText(pending.join("\n"));
  };

  return (
    <>
      <div className={`${CARD} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
              <HiUserAdd className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {tr("inviteTitle", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("inviteSubtitle", d)}
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="invite-base-role"
                className="text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {tr("baseRole", d)}
              </label>
              <Select
                id="invite-base-role"
                sizing="sm"
                className="w-44"
                disabled={busy}
                value={base}
                onChange={(e) => setBase(e.target.value as BaseRole)}
              >
                {(canManageOwners ? BASE_ROLES : NON_OWNER_ROLES).map(
                  (role) => (
                    <option key={role} value={role}>
                      {trDynamic(`base${role}`, d)}
                    </option>
                  )
                )}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="invite-expiry"
                className="text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {tr("expiresIn", d)}
              </label>
              <Select
                id="invite-expiry"
                sizing="sm"
                className="w-32"
                disabled={busy}
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
          </div>
        </div>
      </div>
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {sent.length > 0 && (
        <div className={`${CARD} p-5`}>
          <InviteLinks links={sent} d={d} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionTitle title={tr("emails", d)} help={tr("emailsHint", d)} />
            <div className={`${CARD} flex flex-col gap-3 p-4`}>
              <Label htmlFor="invite-emails" className="sr-only">
                {tr("emails", d)}
              </Label>
              <Textarea
                id="invite-emails"
                rows={3}
                autoFocus
                disabled={busy}
                placeholder={tr("emailsPlaceholder", d)}
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
              />
              {emails.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {emails.map((email) => (
                    <Badge
                      key={email}
                      color={invalid.includes(email) ? "failure" : "gray"}
                    >
                      {email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </section>
          <section className="flex flex-col gap-4">
            <SectionTitle
              title={tr("moduleAccessTitle", d)}
              help={
                fullAccess
                  ? tr("moduleAccessFull", d)
                  : tr("moduleAccessHelp", d)
              }
            />
            {modules.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                roles={catalog.roles.filter((r) => r.module === mod.key)}
                catalog={catalog}
                value={byModule[mod.key] ?? ""}
                includedByBase={fullAccess}
                disabled={busy}
                lang={lang}
                d={d}
                onChange={(key) => setByModule({ ...byModule, [mod.key]: key })}
              />
            ))}
          </section>
        </div>
        <aside className="lg:col-span-1">
          <EffectivePermissions
            permissions={effectivePermissions(base, roles, catalog)}
            catalog={catalog}
            modules={modules}
            help={tr("effectiveHelp", d)}
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <Button as={Link} href={teamPath} color="alternative" size="sm">
          {tr("cancel", d)}
        </Button>
        <Button
          color="blue"
          size="sm"
          disabled={busy || emails.length === 0}
          onClick={submit}
        >
          {busy && <Spinner size="sm" className="mr-2" />}
          {emails.length > 1
            ? tr("sendCount", d, { count: String(emails.length) })
            : tr("send", d)}
        </Button>
      </div>
    </>
  );
}

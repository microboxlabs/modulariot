"use client";

import { Alert, Spinner } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { DetailShell } from "../team/module-access";
import { useMyAccess } from "../team/team-api";
import MailTemplateEditor from "./mail-template-editor";

interface InvitationEmailPageProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** Settings › Team › invitation email: the organization's own invitation template. */
export default function InvitationEmailPage({
  dict,
  lang,
}: InvitationEmailPageProps) {
  const d = dict?.team as I18nRecord;
  const templatesDict = (dict?.mailTemplates as I18nRecord) ?? {};
  const { access, accessError, can } = useMyAccess();
  const failed = Boolean(accessError);
  const loading = !failed && !access;
  const allowed = can("org:update");

  return (
    <DetailShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      backHref={`/${lang}/users/settings/team?tab=invitations`}
      backLabel={tr("backToTeam", d)}
    >
      {loading && <Spinner className="mx-auto" />}
      {failed && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {!loading && !failed && !allowed && (
        <Alert color="gray">{tr("notAllowed", templatesDict)}</Alert>
      )}
      {!loading && !failed && allowed && (
        <MailTemplateEditor
          scope="organization"
          dict={templatesDict}
          lang={lang}
        />
      )}
    </DetailShell>
  );
}

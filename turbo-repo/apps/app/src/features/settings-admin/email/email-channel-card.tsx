"use client";

import { useMemo, useState } from "react";
import { HiOutlineMail } from "react-icons/hi";
import { toast } from "sonner";
import { ResendCredentialModal } from "@/features/credentials/components/bearer-token-credential-modal";
import type {
  BearerTokenFormData,
  CredentialTestResult,
} from "@/features/credentials/credential.types";
import { createCredential } from "@/features/credentials/credentials-data-service";
import { useCredentials } from "@/features/credentials/use-credentials";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ChannelCard, type ChannelPartProps } from "../channels/channel-card";
import { EmailConnectionModal } from "./email-connection-modal";
import {
  emailCreate,
  emailSender,
  emailToForm,
  emailUpdate,
  RESEND_PROVIDER,
} from "./email.types";

interface EmailChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
  /** The Credentials dictionary, for the shared Resend credential form. */
  readonly credentialsDict: I18nRecord;
}

const NO_TEST: CredentialTestResult = { success: false, message: "" };

/** Settings card for the organization's email channel (Resend), used for invitations. */
export default function EmailChannelCard({
  orgSlug,
  dict,
  credentialsDict,
}: EmailChannelCardProps) {
  const emailDict = (dict?.emailChannel as I18nRecord) ?? {};
  const { credentials, refresh } = useCredentials(orgSlug);
  const resendKeys = useMemo(
    () => credentials.filter((c) => c.typeId === "RESEND"),
    [credentials]
  );
  const [creatingKey, setCreatingKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function saveKey(form: BearerTokenFormData) {
    if (!orgSlug) return;
    setSavingKey(true);
    try {
      const credential = await createCredential(orgSlug, "RESEND", form);
      await refresh();
      setCreated(credential.id);
      setCreatingKey(false);
      toast.success(tr("toast.created", credentialsDict));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : tr("toast.saveFailed", credentialsDict)
      );
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <>
      <ChannelCard
        orgSlug={orgSlug}
        provider={RESEND_PROVIDER}
        dict={emailDict}
        icon={<HiOutlineMail className="h-5 w-5 text-gray-500" />}
        toCreate={emailCreate}
        toUpdate={emailUpdate}
        toForm={emailToForm}
        Detail={EmailDetail}
        Modal={EmailConnectionModal}
        modalProps={{
          credentials: resendKeys,
          selectCredential: created,
          onNewCredential: () => setCreatingKey(true),
          dict: emailDict,
        }}
      />
      <ResendCredentialModal
        show={creatingKey}
        onClose={() => setCreatingKey(false)}
        onSubmit={saveKey}
        onTest={() => Promise.resolve(NO_TEST)}
        loading={savingKey}
        dict={credentialsDict}
      />
    </>
  );
}

function EmailDetail({ connection, dict }: ChannelPartProps) {
  return (
    <>
      <span className="font-medium">{tr("fromLabel", dict)}:</span>{" "}
      {emailSender(connection) || "—"}
    </>
  );
}

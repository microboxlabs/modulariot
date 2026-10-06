"use client";

import { HiOutlineMail } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ChannelCard } from "../channels/channel-card";
import { EmailConnectionModal } from "./email-connection-modal";
import {
  emailCreate,
  emailSender,
  emailToForm,
  emailUpdate,
  RESEND_PROVIDER,
  type EmailFormData,
} from "./email.types";

interface EmailChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/** Settings card for the organization's email channel (Resend), used for invitations. */
export default function EmailChannelCard({
  orgSlug,
  dict,
}: EmailChannelCardProps) {
  const emailDict = (dict?.emailChannel as I18nRecord) ?? {};
  return (
    <ChannelCard<EmailFormData>
      orgSlug={orgSlug}
      provider={RESEND_PROVIDER}
      dict={emailDict}
      icon={<HiOutlineMail className="h-5 w-5 text-gray-500" />}
      toCreate={emailCreate}
      toUpdate={emailUpdate}
      toForm={emailToForm}
      detail={(connection) => (
        <>
          <span className="font-medium">{tr("fromLabel", emailDict)}:</span>{" "}
          {emailSender(connection) || "—"}
        </>
      )}
      renderModal={(modal) => (
        <EmailConnectionModal {...modal} orgSlug={orgSlug} dict={emailDict} />
      )}
    />
  );
}

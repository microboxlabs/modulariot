"use client";

import { Badge } from "flowbite-react";
import { FaWhatsapp } from "react-icons/fa";
import { HiClipboardCopy } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ChannelCard, type ChannelPartProps } from "../channels/channel-card";
import type { IntegrationConnection } from "../channels/channel.types";
import { WhatsAppConnectionModal } from "./whatsapp-connection-modal";
import {
  DEFAULT_GRAPH_VERSION,
  formatRecipientList,
  isTruthyFlag,
  WHATSAPP_PROVIDER,
  whatsAppCreate,
  whatsAppUpdate,
  whatsAppWebhookPath,
} from "./whatsapp.types";
import type { WhatsAppFormData } from "./whatsapp.types";

interface WhatsAppChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
  readonly onChanged?: () => void;
}

/** Settings card for the organization's WhatsApp channel. */
export default function WhatsAppChannelCard({
  orgSlug,
  dict,
  onChanged,
}: WhatsAppChannelCardProps) {
  const waDict = (dict?.whatsappChannel as I18nRecord) ?? {};
  return (
    <ChannelCard
      orgSlug={orgSlug}
      provider={WHATSAPP_PROVIDER}
      dict={waDict}
      icon={<FaWhatsapp className="h-5 w-5 text-gray-500" />}
      toCreate={whatsAppCreate}
      toUpdate={whatsAppUpdate}
      toForm={connectionToForm}
      Detail={WhatsAppDetail}
      Badges={WhatsAppBadges}
      Modal={WhatsAppConnectionModal}
      modalProps={{ dict: waDict }}
      onChanged={onChanged}
    />
  );
}

function WhatsAppDetail({ connection, dict }: ChannelPartProps) {
  const phone = connection.metadata?.phone_number_id;
  const webhook = whatsAppWebhookPath(connection.id);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhook);
      toast.success(tr("webhookCopied", dict));
    } catch {
      toast.error(tr("webhookCopyFailed", dict));
    }
  };
  return (
    <>
      <div>
        <span className="font-medium">{tr("phoneLabel", dict)}:</span>{" "}
        {typeof phone === "string" ? phone : "—"}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="font-medium">{tr("webhookLabel", dict)}:</span>
        <code className="rounded bg-gray-100 px-1 text-xs break-all dark:bg-gray-700">
          {webhook}
        </code>
        <button
          type="button"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
          aria-label={tr("webhookCopy", dict)}
          title={tr("webhookCopy", dict)}
          onClick={() => void copy()}
        >
          <HiClipboardCopy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {tr("webhookHelp", dict)}
      </p>
    </>
  );
}

/** The test-mode badge with how many recipients are allowed. */
function WhatsAppBadges({ connection, dict }: ChannelPartProps) {
  if (!isTruthyFlag(connection.metadata?.test_mode_enabled)) return null;
  return (
    <Badge color="gray">
      {tr("testModeBadge", dict)} ·{" "}
      {recipientCount(connection.metadata?.test_recipients)}
    </Badge>
  );
}

function connectionToForm(connection: IntegrationConnection): WhatsAppFormData {
  const meta = connection.metadata ?? {};
  const str = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;
  return {
    name: connection.name,
    phoneNumberId: str(meta.phone_number_id),
    wabaId: str(meta.waba_id),
    graphVersion: str(meta.graph_version, DEFAULT_GRAPH_VERSION),
    baseUrl: connection.baseUrl,
    token: "",
    testModeEnabled: isTruthyFlag(meta.test_mode_enabled),
    testRecipients: formatRecipientList(meta.test_recipients),
    appSecret: "",
    verifyToken: "",
  };
}

/** Count of configured test recipients, from either a JSON array or a delimited string. */
function recipientCount(value: unknown): number {
  return formatRecipientList(value).split("\n").filter(Boolean).length;
}

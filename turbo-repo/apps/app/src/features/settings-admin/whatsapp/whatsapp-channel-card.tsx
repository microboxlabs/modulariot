"use client";

import { Badge } from "flowbite-react";
import { FaWhatsapp } from "react-icons/fa";
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
} from "./whatsapp.types";
import type { WhatsAppFormData } from "./whatsapp.types";

interface WhatsAppChannelCardProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/** Settings card for the organization's WhatsApp channel. */
export default function WhatsAppChannelCard({
  orgSlug,
  dict,
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
    />
  );
}

function WhatsAppDetail({ connection, dict }: ChannelPartProps) {
  const phone = connection.metadata?.phone_number_id;
  return (
    <>
      <span className="font-medium">{tr("phoneLabel", dict)}:</span>{" "}
      {typeof phone === "string" ? phone : "—"}
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
  };
}

/** Count of configured test recipients, from either a JSON array or a delimited string. */
function recipientCount(value: unknown): number {
  return formatRecipientList(value).split("\n").filter(Boolean).length;
}

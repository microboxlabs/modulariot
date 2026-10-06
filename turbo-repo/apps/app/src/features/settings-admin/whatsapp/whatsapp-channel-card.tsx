"use client";

import { Badge } from "flowbite-react";
import { FaWhatsapp } from "react-icons/fa";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ChannelCard } from "../channels/channel-card";
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
    <ChannelCard<WhatsAppFormData>
      orgSlug={orgSlug}
      provider={WHATSAPP_PROVIDER}
      dict={waDict}
      icon={<FaWhatsapp className="h-5 w-5 text-gray-500" />}
      toCreate={whatsAppCreate}
      toUpdate={whatsAppUpdate}
      toForm={connectionToForm}
      detail={(connection) => (
        <>
          <span className="font-medium">{tr("phoneLabel", waDict)}:</span>{" "}
          {typeof connection.metadata?.phone_number_id === "string"
            ? connection.metadata.phone_number_id
            : "—"}
        </>
      )}
      badges={(connection) =>
        isTruthyFlag(connection.metadata?.test_mode_enabled) && (
          <Badge color="gray">
            {tr("testModeBadge", waDict)} ·{" "}
            {recipientCount(connection.metadata?.test_recipients)}
          </Badge>
        )
      }
      renderModal={(modal) => (
        <WhatsAppConnectionModal {...modal} dict={waDict} />
      )}
    />
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

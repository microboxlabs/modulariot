"use client";

import { Badge } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { IntegrationConnection } from "./channel.types";

const STATUS: Record<
  IntegrationConnection["status"],
  { color: "success" | "gray" | "failure"; key: string }
> = {
  ACTIVE: { color: "success", key: "status.active" },
  DRAFT: { color: "gray", key: "status.draft" },
  INACTIVE: { color: "gray", key: "status.inactive" },
  TEST_FAILED: { color: "failure", key: "status.failed" },
};

interface ChannelStatusBadgeProps {
  readonly status: IntegrationConnection["status"];
  readonly dict: I18nRecord;
}

/** A channel connection's status. The dictionary provides `status.*` labels. */
export function ChannelStatusBadge({ status, dict }: ChannelStatusBadgeProps) {
  const entry = STATUS[status] ?? STATUS.DRAFT;
  return <Badge color={entry.color}>{trDynamic(entry.key, dict)}</Badge>;
}

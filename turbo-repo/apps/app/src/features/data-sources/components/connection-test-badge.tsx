"use client";

import { Badge } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface ConnectionTestBadgeProps {
  readonly lastTestedAt?: string;
  readonly lastTestResult?: boolean;
  readonly dict: I18nRecord;
}

export function ConnectionTestBadge({
  lastTestedAt,
  lastTestResult,
  dict,
}: ConnectionTestBadgeProps) {
  if (!lastTestedAt) {
    return <Badge color="gray">{tr("badge.notTested", dict)}</Badge>;
  }

  return (
    <Badge color={lastTestResult ? "success" : "failure"}>
      {lastTestResult ? tr("badge.connected", dict) : tr("badge.failed", dict)}
    </Badge>
  );
}

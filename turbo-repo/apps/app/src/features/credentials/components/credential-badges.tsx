"use client";

import { Badge } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { isBuiltInEnvironment } from "../credential.types";

/**
 * Chips share one grey ground. A test result is the exception: connected is green and
 * failed is red, the same colours the other settings catalogs use for state.
 */
const CHIP = "bg-gray-100 dark:bg-gray-700";

interface EnvironmentBadgeProps {
  readonly environment: string;
  readonly dict: I18nRecord;
}

/**
 * Display name for an environment: the seeded ones are translated, user-created
 * ones are shown exactly as they were typed (there is no key to translate).
 */
export function environmentLabel(
  environment: string,
  dict: I18nRecord
): string {
  return isBuiltInEnvironment(environment)
    ? trDynamic(`environments.${environment}`, dict)
    : environment;
}

/**
 * Production reads darker and heavier than the rest — enough to catch the eye
 * when scanning for the credential that can do real damage, without spending a
 * colour on it.
 */
export function EnvironmentBadge({ environment, dict }: EnvironmentBadgeProps) {
  const isProduction = environment === "PRODUCTION";
  const tone = isProduction
    ? "text-gray-900 font-semibold dark:text-gray-100"
    : "text-gray-500 dark:text-gray-400";
  return (
    <Badge color="gray" size="xs" className={`${CHIP} ${tone}`}>
      {environmentLabel(environment, dict)}
    </Badge>
  );
}

interface CredentialTestBadgeProps {
  readonly lastTestedAt?: string;
  readonly lastTestResult?: boolean;
  readonly dict: I18nRecord;
  /** Drop the timestamp line and carry it as a tooltip (single-line rows). */
  readonly compact?: boolean;
}

export function CredentialTestBadge({
  lastTestedAt,
  lastTestResult,
  dict,
  compact = false,
}: CredentialTestBadgeProps) {
  if (!lastTestedAt) {
    return (
      <Badge
        color="gray"
        size="xs"
        className={`${CHIP} text-gray-400 dark:text-gray-500`}
      >
        {tr("badge.notTested", dict)}
      </Badge>
    );
  }

  const label = lastTestResult
    ? tr("badge.connected", dict)
    : tr("badge.failed", dict);
  const tone = lastTestResult
    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  const badge = (
    <Badge
      color="gray"
      size="xs"
      className={tone}
      title={compact ? new Date(lastTestedAt).toLocaleString() : undefined}
    >
      {label}
    </Badge>
  );

  if (compact) return badge;

  return (
    <div className="flex flex-col items-start gap-1">
      {badge}
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {new Date(lastTestedAt).toLocaleString()}
      </span>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Select } from "flowbite-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import {
  HiCheckCircle,
  HiChevronRight,
  HiTrash,
  HiXCircle,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  usagePath,
  type CredentialListItem,
  type CredentialTestResult,
  type CredentialUsage,
} from "../credential.types";

/**
 * Pieces every credential form shows the same way, regardless of which grant it
 * configures: the test outcome, the blast radius, the delete affordance and the
 * submit label. Only the credential-specific fields differ between the modals,
 * so keeping these here is what stops each new credential type from arriving as
 * a copy of the last one.
 */

interface TestResultLineProps {
  readonly result: CredentialTestResult;
  readonly dict: I18nRecord;
}

/** Outcome of a token grant the operator just exercised. */
export function TestResultLine({ result, dict }: TestResultLineProps) {
  if (result.success) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <HiCheckCircle className="h-4 w-4" />
        {tr("modal.testSuccess", dict)}
        {result.expiresInSeconds ? ` · ${result.expiresInSeconds}s` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
      <HiXCircle className="h-4 w-4" />
      {tr("modal.testFailed", dict)}
      {result.message ? ` · ${result.message}` : ""}
    </span>
  );
}

interface UsedByPanelProps {
  readonly credential: CredentialListItem;
  readonly dict: I18nRecord;
}

/** "Número 123", "Remitente a@b.cl" or the URL, by the connection's provider. */
export function usageDetail(
  usage: CredentialUsage,
  dict: I18nRecord
): string | null {
  if (!usage.detail) return null;
  const key = `usageDetail.${usage.providerType ?? ""}`;
  const text = trDynamic(key, dict, { detail: usage.detail });
  return text === key ? usage.detail : text;
}

function UsageRow({
  usage,
  lang,
  dict,
}: Readonly<{ usage: CredentialUsage; lang: string; dict: I18nRecord }>) {
  const detail = usageDetail(usage, dict);
  return (
    <li>
      <Link
        href={`/${lang}${usagePath(usage)}`}
        className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-600/60"
      >
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {trDynamic(`usageKinds.${usage.kind}`, dict)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
            {usage.label}
          </span>
          {detail && (
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {detail}
            </span>
          )}
        </span>
        <HiChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
      </Link>
    </li>
  );
}

/** Edit-time blast radius: what breaks if this credential changes, each linked to where it is managed. */
export function UsedByPanel({ credential, dict }: UsedByPanelProps) {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? "es";
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.usedBy", dict)}
      </div>
      <ul className="mt-2 flex flex-col gap-0.5">
        {credential.usedBy.map((usage) => (
          <UsageRow key={usage.id} usage={usage} lang={lang} dict={dict} />
        ))}
      </ul>
    </div>
  );
}

interface DeleteHeaderActionProps {
  readonly onDelete: () => void;
  readonly dict: I18nRecord;
}

/** Delete affordance in the modal header, shown only when editing a record. */
export function DeleteHeaderAction({
  onDelete,
  dict,
}: DeleteHeaderActionProps) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={tr("modal.delete", dict)}
      title={tr("modal.delete", dict)}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
    >
      <HiTrash className="h-4 w-4" />
    </button>
  );
}

/** Save / Create / Saving…, picked the same way by every credential form. */
export function credentialSubmitLabel(
  loading: boolean,
  isEdit: boolean,
  dict: I18nRecord
): string {
  if (loading) return tr("modal.saving", dict);
  return isEdit ? tr("modal.saveButton", dict) : tr("modal.createButton", dict);
}

interface TokenEndpointPreviewProps {
  readonly url: string;
  readonly dict: I18nRecord;
}

/**
 * Read-only echo of the endpoint the credential will actually call.
 *
 * Shown by the forms that derive the URL from something else — a directory id,
 * a tenant domain — so a typo in the input is visible before saving rather than
 * as a failed grant afterwards.
 */
export function TokenEndpointPreview({ url, dict }: TokenEndpointPreviewProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.tokenEndpoint", dict)}
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-gray-600 dark:text-gray-400">
        {url}
      </code>
    </div>
  );
}

interface AdvancedSectionProps {
  readonly children: ReactNode;
  readonly dict: I18nRecord;
}

/** Collapsed container for the fields a correct config rarely needs to touch. */
export function AdvancedSection({ children, dict }: AdvancedSectionProps) {
  return (
    <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.advanced", dict)}
      </summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  );
}

interface TokenRequestFormatFieldProps {
  readonly id: string;
  /** The caller's `register("tokenRequestFormat")`, so this stays untyped by T. */
  readonly registration: UseFormRegisterReturn;
  /** Provider-specific guidance; omitted where the choice needs no explaining. */
  readonly helpKey?: string;
  readonly dict: I18nRecord;
}

/** Whether the token request is form-encoded or JSON — the same two everywhere. */
export function TokenRequestFormatField({
  id,
  registration,
  helpKey,
  dict,
}: TokenRequestFormatFieldProps) {
  return (
    <SettingsFormField id={id} label={tr("modal.tokenRequestFormat", dict)}>
      <Select id={id} {...registration}>
        <option value="FORM">{tr("modal.tokenFormatForm", dict)}</option>
        <option value="JSON">{tr("modal.tokenFormatJson", dict)}</option>
      </Select>
      {helpKey && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {trDynamic(helpKey, dict)}
        </p>
      )}
    </SettingsFormField>
  );
}

"use client";

import { HiCheckCircle, HiTrash, HiXCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  CredentialListItem,
  CredentialTestResult,
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

/** Edit-time blast radius: what breaks if this credential changes. */
export function UsedByPanel({ credential, dict }: UsedByPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {tr("modal.usedBy", dict)}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {credential.usedBy.map((usage) => (
          <li
            key={usage.id}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {trDynamic(`usageKinds.${usage.kind}`, dict)}
            </span>
            {usage.label}
          </li>
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
export function DeleteHeaderAction({ onDelete, dict }: DeleteHeaderActionProps) {
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

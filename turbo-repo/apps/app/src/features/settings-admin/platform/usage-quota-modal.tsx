"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Label, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { SwitcherOrg } from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";
import { ApiError } from "../data/json-client";
import OrgSearchPicker from "./org-search-picker";

/** The organization being edited, or null to pick one. */
export interface UsageQuotaTarget {
  slug: string;
  name: string;
  ownQuota: number | null;
}

export type QuotaRequest<V> =
  | { ok: true; value: V }
  | { ok: false; error: string };

interface UsageQuotaModalProps<V> {
  readonly show: boolean;
  readonly target: UsageQuotaTarget | null;
  readonly orgs: readonly SwitcherOrg[];
  /** Organizations that already have their own quota; the picker blocks them. */
  readonly subscribed: ReadonlySet<string>;
  readonly planQuota: number;
  /** Prefix of the field ids. */
  readonly idPrefix: string;
  /** The request for the typed quota, or the message to show. */
  readonly toRequest: (quota: string) => QuotaRequest<V>;
  readonly onClose: () => void;
  readonly onSave: (organization: string, value: V) => Promise<void>;
  /** Texts under `modal.*`, plus `save` and `saveError`. */
  readonly dict: I18nRecord;
  /** Fields next to the quota, e.g. what happens when it is used up. */
  readonly children?: ReactNode;
}

/**
 * Gives an organization its own monthly quota, or changes it: the organization
 * picker that searches like the header's switcher, the quota (empty uses the
 * plan's) and any `children`.
 */
export default function UsageQuotaModal<V>({
  show,
  target,
  orgs,
  subscribed,
  planQuota,
  idPrefix,
  toRequest,
  onClose,
  onSave,
  dict,
  children,
}: UsageQuotaModalProps<V>) {
  const [slug, setSlug] = useState("");
  const [quota, setQuota] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSlug(target?.slug ?? "");
    setQuota(target?.ownQuota == null ? "" : String(target.ownQuota));
    setError(null);
  }, [show, target]);

  const submit = async () => {
    if (!slug) {
      setError(new Error(tr("modal.pickFirst", dict)));
      return;
    }
    const result = toRequest(quota);
    if (!result.ok) {
      setError(new Error(result.error));
      return;
    }
    setIsSaving(true);
    try {
      await onSave(slug, result.value);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new Error(tr("saveError", dict))
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={target ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)}
      subtitle={target?.name ?? tr("modal.addSubtitle", dict)}
      submitLabel={tr("save", dict)}
      cancelLabel={tr("modal.cancel", dict)}
      isProcessing={isSaving}
      error={error}
      onSubmit={() => void submit()}
      size="3xl"
    >
      <div className="flex flex-col gap-4">
        {!target && (
          <div>
            <Label htmlFor={`${idPrefix}-org`}>
              {tr("modal.organization", dict)}
            </Label>
            <OrgSearchPicker
              id={`${idPrefix}-org`}
              orgs={orgs}
              value={slug}
              onChange={setSlug}
              placeholder={tr("modal.searchOrganization", dict)}
              blockedReason={(o) =>
                subscribed.has(o.slug)
                  ? tr("modal.alreadySubscribed", dict)
                  : null
              }
              noMatches={tr("modal.noMatches", dict)}
              refine={(hidden) =>
                tr("modal.refine", dict, { count: String(hidden) })
              }
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-value`}>
              {tr("modal.quota", dict)}
            </Label>
            <TextInput
              id={`${idPrefix}-value`}
              type="number"
              min={0}
              step={1}
              placeholder={tr("modal.quotaPlaceholder", dict, {
                quota: planQuota.toLocaleString(),
              })}
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tr("modal.quotaHelp", dict)}
            </p>
          </div>
          {children}
        </div>
      </div>
    </FormModal>
  );
}

/**
 * Which organization the quota modal edits, and opening it for a new one when
 * the page header's assign button is pressed.
 */
export function useUsageQuotaEditor<T extends UsageQuotaTarget>(
  assigning: boolean,
  onAssignDone: () => void
) {
  const [editing, setEditing] = useState<T | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!assigning) return;
    setEditing(null);
    setShow(true);
    onAssignDone();
  }, [assigning, onAssignDone]);

  return {
    editing,
    show,
    open: (target: T | null) => {
      setEditing(target);
      setShow(true);
    },
    close: () => setShow(false),
  };
}

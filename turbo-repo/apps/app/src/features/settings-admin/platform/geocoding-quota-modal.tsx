"use client";

import { useEffect, useState } from "react";
import { Label, Radio, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  OnExhausted,
  SetGeocodingSubscription,
} from "@/features/geocoding/geocoding-plan.types";
import type { SwitcherOrg } from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";
import { ApiError } from "../data/json-client";
import { toSubscriptionRequest } from "./geocoding-plan-form";
import OrgSearchPicker from "./org-search-picker";

/** The organization being edited, or null to pick one. */
export interface QuotaTarget {
  slug: string;
  name: string;
  ownQuota: number | null;
  onExhausted: OnExhausted;
}

interface GeocodingQuotaModalProps {
  readonly show: boolean;
  readonly target: QuotaTarget | null;
  readonly orgs: readonly SwitcherOrg[];
  /** Organizations that already have a subscription. */
  readonly subscribed: ReadonlySet<string>;
  readonly planQuota: number;
  readonly onClose: () => void;
  readonly onSave: (
    organization: string,
    value: SetGeocodingSubscription
  ) => Promise<void>;
  readonly dict: I18nRecord;
}

const MODES: readonly OnExhausted[] = ["review", "overage"];

/** Gives an organization its geocoding quota, or changes it. */
export default function GeocodingQuotaModal({
  show,
  target,
  orgs,
  subscribed,
  planQuota,
  onClose,
  onSave,
  dict,
}: GeocodingQuotaModalProps) {
  const [slug, setSlug] = useState("");
  const [quota, setQuota] = useState("");
  const [mode, setMode] = useState<OnExhausted>("review");
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSlug(target?.slug ?? "");
    setQuota(target?.ownQuota == null ? "" : String(target.ownQuota));
    setMode(target?.onExhausted ?? "review");
    setError(null);
  }, [show, target]);

  const submit = async () => {
    if (!slug) {
      setError(new Error(tr("modal.pickFirst", dict)));
      return;
    }
    const result = toSubscriptionRequest({
      monthlyQuota: quota,
      onExhausted: mode,
    });
    if (!result.ok) {
      setError(new Error(trDynamic(`errors.${result.error}`, dict)));
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
            <Label htmlFor="geo-quota-org">
              {tr("modal.organization", dict)}
            </Label>
            <OrgSearchPicker
              id="geo-quota-org"
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
            <Label htmlFor="geo-quota-value">{tr("modal.quota", dict)}</Label>
            <TextInput
              id="geo-quota-value"
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
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-gray-900 dark:text-white">
              {tr("modal.onExhausted", dict)}
            </legend>
            {MODES.map((m) => (
              <div key={m} className="flex items-start gap-2">
                <Radio
                  id={`geo-quota-${m}`}
                  name="geo-quota-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                <Label htmlFor={`geo-quota-${m}`} className="font-normal">
                  <span className="block font-medium">
                    {trDynamic(`modes.${m}.label`, dict)}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {trDynamic(`modes.${m}.help`, dict)}
                  </span>
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
      </div>
    </FormModal>
  );
}

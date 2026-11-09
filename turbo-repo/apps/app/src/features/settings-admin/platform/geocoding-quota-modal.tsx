"use client";

import { useEffect, useState } from "react";
import { Label, Radio } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  OnExhausted,
  SetGeocodingSubscription,
} from "@/features/geocoding/geocoding-plan.types";
import type { SwitcherOrg } from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";
import { toSubscriptionRequest } from "./geocoding-plan-form";
import UsageQuotaModal, { type UsageQuotaTarget } from "./usage-quota-modal";

/** The organization being edited, or null to pick one. */
export interface QuotaTarget extends UsageQuotaTarget {
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

/** Gives an organization its geocoding quota and what happens when it is used up. */
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
  const [mode, setMode] = useState<OnExhausted>("review");

  useEffect(() => {
    if (show) setMode(target?.onExhausted ?? "review");
  }, [show, target]);

  return (
    <UsageQuotaModal
      show={show}
      target={target}
      orgs={orgs}
      subscribed={subscribed}
      planQuota={planQuota}
      idPrefix="geo-quota"
      toRequest={(quota) => {
        const result = toSubscriptionRequest({
          monthlyQuota: quota,
          onExhausted: mode,
        });
        return result.ok
          ? result
          : { ok: false, error: trDynamic(`errors.${result.error}`, dict) };
      }}
      onClose={onClose}
      onSave={onSave}
      dict={dict}
    >
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
    </UsageQuotaModal>
  );
}

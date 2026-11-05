"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HiOutlineMap } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import {
  geocodingPlanDraftFrom,
  toGeocodingPlanRequest,
  type GeocodingPlanDraft,
  type GeocodingPlanError,
} from "./geocoding-plan-form";
import UsagePlanSection, {
  PlanNote,
  type PlanField,
} from "./usage-plan-section";
import { useGeocodingPlan } from "./use-geocoding-plan";

type NumberKey = keyof Omit<GeocodingPlanDraft, "enforced">;

/** Each number field: its id, label key and bounds; prices go to a hundredth of a cent. */
const FIELDS: readonly {
  key: NumberKey;
  id: string;
  label: string;
  min: number;
  max?: number;
  step: number;
}[] = [
  {
    key: "resolutionsPerMonth",
    id: "geo-plan-quota",
    label: "resolutions",
    min: 0,
    step: 1,
  },
  {
    key: "alertPct",
    id: "geo-plan-alert",
    label: "alertPct",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "monthlyPriceUsd",
    id: "geo-plan-price",
    label: "monthlyPrice",
    min: 0,
    step: 0.01,
  },
  {
    key: "overagePriceUsd",
    id: "geo-plan-overage",
    label: "overagePrice",
    min: 0,
    step: 0.0001,
  },
];

interface GeocodingPlanSectionProps {
  readonly dict: I18nRecord;
}

/**
 * The geocoding plan: prices, the default monthly quota, the alert share and
 * whether quotas are applied. The provider is a connection of the Plataforma
 * scope, in Conexiones; each organization's quota is under Organizaciones.
 */
export default function GeocodingPlanSection({
  dict,
}: GeocodingPlanSectionProps) {
  const { lang } = useParams<{ lang: string }>();
  const { plan, isLoading, error, save } = useGeocodingPlan();
  const [draft, setDraft] = useState<GeocodingPlanDraft | null>(null);
  const [problem, setProblem] = useState<GeocodingPlanError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (plan) setDraft(geocodingPlanDraftFrom(plan));
  }, [plan]);

  const submit = async () => {
    if (!draft) return;
    const result = toGeocodingPlanRequest(draft);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setIsSaving(true);
    try {
      await save(result.value);
      toast.success(tr("saved", dict));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", dict)
      );
    } finally {
      setIsSaving(false);
    }
  };

  const fields: PlanField[] = draft
    ? FIELDS.map((f) => ({
        id: f.id,
        label: trDynamic(f.label, dict),
        value: draft[f.key],
        min: f.min,
        max: f.max,
        step: f.step,
        onChange: (value) => setDraft({ ...draft, [f.key]: value }),
      }))
    : [];

  return (
    <UsagePlanSection
      icon={HiOutlineMap}
      title={tr("title", dict)}
      description={tr("description", dict)}
      hint={tr("providerHint", dict)}
      isLoading={isLoading}
      loadError={error ? tr("loadError", dict) : null}
      enforced={
        draft && {
          checked: draft.enforced,
          label: tr("enforced", dict),
          help: draft.enforced
            ? tr("enforcedOn", dict)
            : tr("enforcedOff", dict),
          onChange: (enforced) => setDraft({ ...draft, enforced }),
        }
      }
      fields={fields}
      notes={
        <>
          <PlanNote first>{tr("countHelp", dict)}</PlanNote>
          <PlanNote>
            {tr("alertsHint", dict)}{" "}
            <Link
              href={`/${lang}/users/settings/communications?section=rules`}
              className="font-medium text-blue-600 hover:underline dark:text-blue-500"
            >
              {tr("alertsLink", dict)}
            </Link>
          </PlanNote>
        </>
      }
      problem={problem && trDynamic(`errors.${problem}`, dict)}
      isSaving={isSaving}
      saveLabel={tr("save", dict)}
      savingLabel={tr("saving", dict)}
      onSave={() => void submit()}
    />
  );
}

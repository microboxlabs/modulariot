"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Label,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
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
import { useGeocodingPlan } from "./use-geocoding-plan";

interface GeocodingPlanSectionProps {
  readonly dict: I18nRecord;
}

const SECTION =
  "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";

/**
 * The geocoding plan: prices, the default monthly quota, the alert share and
 * whether quotas are applied. The provider is a connection of the Plataforma
 * scope, in Conexiones; each organization's quota is under Organizaciones.
 */
export default function GeocodingPlanSection({
  dict,
}: GeocodingPlanSectionProps) {
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

  const field = (
    id: string,
    key: keyof Omit<GeocodingPlanDraft, "enforced">,
    label: string
  ) =>
    draft && (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <TextInput
          id={id}
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </div>
    );

  return (
    <section className={SECTION}>
      <div className="flex items-center gap-2">
        <HiOutlineMap className="h-5 w-5 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("title", dict)}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {tr("providerHint", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {draft && (
        <>
          <div className="mt-4">
            <ToggleSwitch
              checked={draft.enforced}
              label={tr("enforced", dict)}
              onChange={(enforced) => setDraft({ ...draft, enforced })}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {draft.enforced
                ? tr("enforcedOn", dict)
                : tr("enforcedOff", dict)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {field(
              "geo-plan-quota",
              "resolutionsPerMonth",
              tr("resolutions", dict)
            )}
            {field("geo-plan-alert", "alertPct", tr("alertPct", dict))}
            {field(
              "geo-plan-price",
              "monthlyPriceUsd",
              tr("monthlyPrice", dict)
            )}
            {field(
              "geo-plan-overage",
              "overagePriceUsd",
              tr("overagePrice", dict)
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("countHelp", dict)}
          </p>

          {problem && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {trDynamic(`errors.${problem}`, dict)}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              color="blue"
              disabled={isSaving}
              onClick={() => void submit()}
            >
              {isSaving ? tr("saving", dict) : tr("save", dict)}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

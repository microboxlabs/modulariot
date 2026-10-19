"use client";

import { useEffect, useState } from "react";
import { Button, Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlineCreditCard } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import {
  planDraftFrom,
  toPlanRequest,
  yearlySeatPrice,
  type PlanDraft,
  type PlanDraftError,
} from "./harness-plan-form";
import { useHarnessPlan } from "./use-model-providers";

interface HarnessPlanSectionProps {
  readonly dict: I18nRecord;
}

/**
 * The seat plan: what a seat costs and how many tokens it adds to its
 * organization's monthly pool. How fast each model uses the pool is set per
 * model, under AI models.
 */
export default function HarnessPlanSection({ dict }: HarnessPlanSectionProps) {
  const { plan, isLoading, error, save } = useHarnessPlan();
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [problem, setProblem] = useState<PlanDraftError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (plan) setDraft(planDraftFrom(plan));
  }, [plan]);

  const submit = async () => {
    if (!draft) return;
    const result = toPlanRequest(draft);
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

  const preview = draft ? toPlanRequest(draft) : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <HiOutlineCreditCard className="h-5 w-5 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("title", dict)}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {draft && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="plan-seat-price">{tr("seatPrice", dict)}</Label>
              <TextInput
                id="plan-seat-price"
                inputMode="decimal"
                value={draft.seatPriceUsd}
                onChange={(e) =>
                  setDraft({ ...draft, seatPriceUsd: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="plan-tokens">{tr("tokensPerSeat", dict)}</Label>
              <TextInput
                id="plan-tokens"
                inputMode="decimal"
                value={draft.tokensPerSeatMillions}
                onChange={(e) =>
                  setDraft({ ...draft, tokensPerSeatMillions: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="plan-discount">
                {tr("yearlyDiscount", dict)}
              </Label>
              <TextInput
                id="plan-discount"
                inputMode="decimal"
                value={draft.yearlyDiscountPct}
                onChange={(e) =>
                  setDraft({ ...draft, yearlyDiscountPct: e.target.value })
                }
              />
            </div>
          </div>

          {preview?.ok && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {tr("summary", dict, {
                price: String(preview.value.seatPriceUsd),
                yearly: String(
                  yearlySeatPrice(
                    preview.value.seatPriceUsd,
                    preview.value.yearlyDiscountPct
                  )
                ),
                tokens: (
                  preview.value.tokensPerSeat / 1_000_000
                ).toLocaleString(),
              })}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("multiplierHelp", dict)}
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

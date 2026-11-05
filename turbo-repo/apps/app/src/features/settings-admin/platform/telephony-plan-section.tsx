"use client";

import { useEffect, useState } from "react";
import { HiOutlinePhone } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  PRICE_FIELDS,
  telephonyPlanDraftFrom,
  toTelephonyPlanRequest,
  type TelephonyPlanDraft,
} from "@/features/telephony/telephony-plan";
import { ApiError } from "../data/json-client";
import UsagePlanSection, {
  PlanNote,
  type PlanField,
} from "./usage-plan-section";
import { useTelephonyPlan } from "./use-telephony-plan";

type NumberKey = keyof Omit<TelephonyPlanDraft, "enforced">;

/** Minutes are whole; prices go to a hundredth of a cent. */
const FIELDS: readonly { key: NumberKey; step: number }[] = [
  { key: "minutesPerMonth", step: 1 },
  ...PRICE_FIELDS.map((key) => ({ key, step: 0.0001 })),
];

/**
 * The telephony plan: the default monthly minutes, the price of a minute per
 * destination and of a WhatsApp template, and whether the minutes are applied.
 * The line is the TELNYX connection of the Plataforma scope, in Conexiones;
 * each organization's minutes are under Organizaciones.
 */
export default function TelephonyPlanSection({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const { plan, isLoading, error, save } = useTelephonyPlan();
  const [draft, setDraft] = useState<TelephonyPlanDraft | null>(null);
  const [problem, setProblem] = useState<NumberKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (plan) setDraft(telephonyPlanDraftFrom(plan));
  }, [plan]);

  const submit = async () => {
    if (!draft) return;
    const result = toTelephonyPlanRequest(draft);
    if (!result.ok) {
      setProblem(result.field as NumberKey);
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
        id: `telephony-plan-${f.key}`,
        label: trDynamic(`fields.${f.key}`, dict),
        value: draft[f.key],
        min: 0,
        step: f.step,
        onChange: (value) => setDraft({ ...draft, [f.key]: value }),
      }))
    : [];

  return (
    <UsagePlanSection
      icon={HiOutlinePhone}
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
      notes={<PlanNote first>{tr("countHelp", dict)}</PlanNote>}
      problem={problem && trDynamic(`errors.${problem}`, dict)}
      isSaving={isSaving}
      saveLabel={tr("save", dict)}
      savingLabel={tr("saving", dict)}
      onSave={() => void submit()}
    />
  );
}

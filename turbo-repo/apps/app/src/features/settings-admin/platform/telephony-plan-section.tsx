"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Label,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  PRICE_FIELDS,
  telephonyPlanDraftFrom,
  toTelephonyPlanRequest,
  type TelephonyPlanDraft,
} from "@/features/telephony/telephony-plan";
import { useTelephonyPlan } from "./use-telephony-plan";

const SECTION =
  "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";

/**
 * The managed telephony plan: price per billed minute by destination, WhatsApp
 * prices, default monthly minutes and whether they are enforced. The managed
 * line is the TELNYX connection of the Plataforma scope, in Conexiones.
 */
export default function TelephonyPlanSection({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const { plan, isLoading, error, save } = useTelephonyPlan();
  const [draft, setDraft] = useState<TelephonyPlanDraft | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) setDraft(telephonyPlanDraftFrom(plan));
  }, [plan]);

  if (isLoading || (!draft && !error)) return <Spinner size="md" />;
  if (error || !draft)
    return <p className="text-sm text-red-600">{tr("loadFailed", dict)}</p>;

  const submit = async () => {
    const req = toTelephonyPlanRequest(draft);
    if (!req.ok) {
      setBad(req.field);
      return;
    }
    setBad(null);
    setSaving(true);
    try {
      await save(req.value);
      toast.success(tr("saved", dict));
    } catch {
      toast.error(tr("saveFailed", dict));
    } finally {
      setSaving(false);
    }
  };

  const field = (name: keyof TelephonyPlanDraft & string) => (
    <div key={name}>
      <Label htmlFor={`telephony-${name}`}>
        {trDynamic(`fields.${name}`, dict)}
      </Label>
      <TextInput
        id={`telephony-${name}`}
        inputMode="decimal"
        value={draft[name] as string}
        color={bad === name ? "failure" : undefined}
        onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
      />
    </div>
  );

  return (
    <section className={SECTION}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {tr("title", dict)}
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {field("minutesPerMonth")}
        {PRICE_FIELDS.map((f) => field(f))}
      </div>
      {bad && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {tr("invalid", dict)}
        </p>
      )}
      <div className="mt-4">
        <ToggleSwitch
          checked={draft.enforced}
          label={tr("enforced", dict)}
          onChange={(enforced) => setDraft({ ...draft, enforced })}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("enforcedHelp", dict)}
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={saving} onClick={() => void submit()}>
          {tr("save", dict)}
        </Button>
      </div>
    </section>
  );
}

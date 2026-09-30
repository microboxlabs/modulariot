"use client";

import { useEffect, useState } from "react";
import { HiChevronRight } from "react-icons/hi";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  useLevelResponse,
  type Step,
} from "@/features/symptoms/maintainer/maintainer-api";

/** Fills a step's script with the case's values; unknown variables stay as written. */
export function fillScript(
  script: string,
  treatment: TreatmentsGeneralResponseItem | null
): string {
  const trip = treatment?.trip_info;
  const values: Record<string, string | undefined> = {
    conductor: trip?.driver,
    patente: trip?.asset_id,
    ruta: trip ? `${trip.origin} → ${trip.destination}` : undefined,
  };
  return script.replaceAll(
    /\{\{\s*(\w+)\s*\}\}/g,
    (all, name: string) => values[name] ?? all
  );
}

/** Which step is due after {@code elapsedSeconds}, by the steps' cumulative minutes. */
export function stepAt(steps: Step[], elapsedSeconds: number): number {
  let end = 0;
  for (let i = 0; i < steps.length; i++) {
    end += (steps[i].budgetMinutes ?? 0) * 60;
    if (elapsedSeconds < end) return i;
  }
  return steps.length - 1;
}

const CHANNEL_KEYS: Record<string, string> = {
  call: "channelCall",
  whatsapp: "channelWhatsapp",
  teams: "channelTeams",
  email: "channelEmail",
};

function channelLabel(channel: string | null, d: I18nRecord) {
  const key = channel ? CHANNEL_KEYS[channel] : undefined;
  return key ? trDynamic(key, d) : (channel ?? "");
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The escalation ladder the symptom's owner set for this level: who to
 * contact, in order, within the SLA, and what to say. The due step follows
 * the time since the operator opened the case; skipping one asks why.
 */
export default function EscalationLadderCard({
  dict,
  treatmentData,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
}>) {
  const d = (dict.symptoms as I18nRecord)?.ladder as I18nRecord;
  const symptom = treatmentData?.symptom_info;
  const { data } = useLevelResponse(
    symptom?.name ?? null,
    symptom?.icu_code ?? null
  );
  const [elapsed, setElapsed] = useState(0);
  const [skippedTo, setSkippedTo] = useState<number | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed((Date.now() - started) / 1000),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  const response = data?.level.response;
  const steps = response?.steps ?? [];
  if (!data || !response?.operator || steps.length === 0) return null;

  const due = Math.max(stepAt(steps, elapsed), skippedTo ?? 0);
  const step = steps[due];
  const stepEnd = steps
    .slice(0, due + 1)
    .reduce((sum, s) => sum + (s.budgetMinutes ?? 0) * 60, 0);
  const sla = (response.slaMinutes ?? 0) * 60;

  return (
    <section
      className="mx-3 mb-2 mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
        <span className="font-semibold uppercase tracking-wide">
          {tr("title", d)}
        </span>
        <span>· v{data.version}</span>
        {sla > 0 && (
          <span
            className={`ml-auto font-mono ${elapsed > sla ? "text-red-600 dark:text-red-400" : ""}`}
          >
            SLA {clock(sla - elapsed)}
          </span>
        )}
      </div>
      <ol className="mt-2 flex flex-col gap-1">
        {steps.map((s, i) => {
          const key = `ladder-${i}`;
          let tone = "text-gray-400 dark:text-gray-500";
          if (i === due) tone = "font-semibold text-gray-900 dark:text-white";
          else if (i < due)
            tone = "text-gray-500 line-through dark:text-gray-400";
          return (
            <li key={key} className={`flex items-center gap-2 text-sm ${tone}`}>
              <span className="w-4 text-xs">{i + 1}.</span>
              <span className="flex-1">{s.role || tr("anyone", d)}</span>
              <span className="text-xs">{channelLabel(s.channel, d)}</span>
              <span className="w-12 text-right text-xs">
                {s.budgetMinutes ?? "—"} min
              </span>
            </li>
          );
        })}
      </ol>
      {step.script && (
        <blockquote className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          <span className="mb-1 block text-xs text-gray-500">
            {tr("say", d)}
          </span>
          {fillScript(step.script, treatmentData)}
        </blockquote>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span>{tr("dueIn", d, { time: clock(stepEnd - elapsed) })}</span>
        {due < steps.length - 1 && !skipping && (
          <button
            type="button"
            className="ml-auto flex items-center text-blue-700 hover:underline dark:text-blue-300"
            onClick={() => setSkipping(true)}
          >
            {tr("skip", d)}
            <HiChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {skipping && (
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label={tr("skipReason", d)}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            placeholder={tr("skipReason", d)}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={!reason.trim()}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            onClick={() => {
              setSkippedTo(due + 1);
              setSkipping(false);
              setReason("");
            }}
          >
            {tr("skipConfirm", d)}
          </button>
        </div>
      )}
    </section>
  );
}

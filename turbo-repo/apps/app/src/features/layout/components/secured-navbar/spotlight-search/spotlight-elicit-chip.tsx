"use client";

import { useState } from "react";
import { HiOutlineLightBulb } from "react-icons/hi";
import { toast } from "sonner";
import type { HarnessAssumption } from "@microboxlabs/miot-harness-client";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Elicit chip: when a run answered using a business term it couldn't ground, ask
 * the user to confirm the interpretation right where the gap surfaced. "Yes,
 * remember" stages a knowledge candidate (connection stamped by the harness) for
 * review — the capture half of the learning loop, driven by real interaction.
 */
async function rememberCandidate(
  assumption: HarnessAssumption,
  runId: string | undefined,
): Promise<boolean> {
  if (!assumption.connection) return false;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/knowledge/candidates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection: assumption.connection,
          term: assumption.term,
          kind: "term",
          scope: "tenant",
          body: assumption.predicate
            ? `${assumption.interpretation}\n\n${assumption.predicate}`
            : assumption.interpretation,
          ...(runId && { provenance: { run_id: runId } }),
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

function ElicitChip({
  assumption,
  runId,
  dict,
}: Readonly<{
  assumption: HarnessAssumption;
  runId?: string;
  dict: I18nRecord;
}>) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  if (state === "done") return null;

  async function remember() {
    setState("saving");
    const ok = await rememberCandidate(assumption, runId);
    if (ok) {
      setState("done");
      toast.success(tr("saved", dict, { term: assumption.term }));
    } else {
      setState("idle");
      toast.error(tr("error", dict));
    }
  }

  return (
    <div className="mx-2 my-2 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm dark:border-yellow-900/60 dark:bg-yellow-950/40">
      <HiOutlineLightBulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
      <div className="min-w-0 flex-1">
        <p className="text-gray-700 dark:text-gray-200">
          {tr("prompt", dict, {
            term: assumption.term,
            interpretation: assumption.interpretation,
          })}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={remember}
            disabled={state === "saving"}
            className="rounded bg-yellow-500 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {tr("remember", dict)}
          </button>
          <button
            type="button"
            onClick={() => setState("done")}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {tr("dismiss", dict)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SpotlightElicitChips({
  assumptions,
  runId,
  dict,
}: Readonly<{
  assumptions?: HarnessAssumption[];
  runId?: string;
  dict?: I18nRecord;
}>) {
  if (!assumptions || assumptions.length === 0) return null;
  const d = (dict ?? {}) as I18nRecord;
  return (
    <div>
      {assumptions.map((a, i) => (
        <ElicitChip key={`${a.term}-${i}`} assumption={a} runId={runId} dict={d} />
      ))}
    </div>
  );
}

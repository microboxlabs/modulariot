import { BsStars } from "react-icons/bs";
import { HiCheck } from "react-icons/hi";
import { toolLabelKey, type HarnessStreamProgress } from "./harness-stream";

export interface HarnessProgressLabels {
  /** Phase → human-readable line (from the spotlight.progress dictionary). */
  phases: Record<string, string>;
  /** Primitive name (toolLabelKey) → human-readable step label. */
  tools: Record<string, string>;
}

function StepSpinner() {
  return (
    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-orange-300 border-t-transparent animate-spin dark:border-orange-500 dark:border-t-transparent" />
  );
}

/**
 * Live chain-of-thought panel shown while a harness search streams: the
 * current phase, each tool step as it starts/completes, and the model's
 * thinking text as it arrives. Replaces the blind skeleton — the user sees
 * what the harness is actually doing during the ~40s agentic run.
 */
export function SpotlightHarnessProgress({
  progress,
  labels,
}: Readonly<{ progress: HarnessStreamProgress; labels: HarnessProgressLabels }>) {
  const phaseLabel = labels.phases[progress.phase] ?? labels.phases.connecting ?? "…";

  return (
    <output aria-live="polite" className="block px-4 py-2.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-50 dark:bg-orange-900/30 ring-1 ring-inset ring-black/6 dark:ring-white/10 animate-harness-think">
          <BsStars className="h-3 w-3 text-orange-500 dark:text-orange-400" />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5 pt-0.5">
          {/* Current phase */}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {phaseLabel}
          </p>

          {/* Tool steps — the visible chain of thought */}
          {progress.steps.length > 0 && (
            <ul className="flex flex-col gap-1">
              {progress.steps.map((step, i) => (
                <li
                  // Tools can repeat (two acs_query calls) — index disambiguates.
                  key={`${step.tool}-${i}`}
                  className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  {step.status === "done" ? (
                    <HiCheck className="h-3 w-3 shrink-0 text-green-500 dark:text-green-400" />
                  ) : (
                    <StepSpinner />
                  )}
                  <span className="truncate">
                    {labels.tools[toolLabelKey(step.tool)] ?? step.tool}
                    <span className="ml-1 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {step.tool}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Streaming thinking text */}
          {progress.thinking && (
            <p className="text-xs italic text-gray-400 dark:text-gray-500 line-clamp-2">
              {progress.thinking}
            </p>
          )}
        </div>
      </div>
    </output>
  );
}

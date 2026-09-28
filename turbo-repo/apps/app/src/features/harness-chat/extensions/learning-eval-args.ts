/**
 * A before/after evaluation of knowledge changes, as the harness's learning
 * API returns it and as `run_learning_eval` summarizes it.
 */

export const RUN_LEARNING_EVAL_TOOL = "run_learning_eval";
export const SHOW_LEARNING_EVAL_TOOL = "show_learning_eval";

export type EvalSummary = {
  baseline_avg: number | null;
  candidate_avg: number | null;
  improved: number;
  regressed: number;
  unchanged: number;
};

export type EvalRun = {
  answer: string;
  score: number | null;
  reason: string;
  run_id?: string | null;
  seconds?: number | null;
  tokens?: number | null;
  skills_used?: string[];
  model?: string | null;
  /** Why the run gave no answer. */
  error?: string | null;
  /** Whether the expected skills, and no unexpected ones, were used. */
  trigger?: { ok: boolean; missing: string[]; unexpected: string[] } | null;
};

export type EvalCase = {
  id?: string;
  question: string;
  expectation: string;
  expect_skill?: string | string[] | null;
  expect_no_skill?: string | string[] | null;
};

export type EvalResult = {
  case: EvalCase;
  baseline: EvalRun | null;
  candidate: EvalRun | null;
};

export type Evaluation = {
  id: string;
  status: "running" | "done" | "failed";
  model: string | null;
  progress?: { done: number; total: number };
  summary: EvalSummary | null;
  results: EvalResult[];
  error?: string | null;
};

export type ShowLearningEvalArgs = {
  evaluationId: string | null;
  status?: string;
  model?: string | null;
  summary?: EvalSummary | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evalSummaryOf(value: unknown): EvalSummary | null {
  if (!isRecord(value)) return null;
  const baseline = num(value.baseline_avg);
  const candidate = num(value.candidate_avg);
  if (baseline === null && candidate === null) return null;
  return {
    baseline_avg: baseline,
    candidate_avg: candidate,
    improved: num(value.improved) ?? 0,
    regressed: num(value.regressed) ?? 0,
    unchanged: num(value.unchanged) ?? 0,
  };
}

/** The card's arguments from a `run_learning_eval` result; null when the
 * result names no evaluation and has no summary. */
export function learningEvalArgsOf(
  value: unknown
): ShowLearningEvalArgs | null {
  if (!isRecord(value)) return null;
  const evaluation = isRecord(value.evaluation) ? value.evaluation : value;
  const evaluationId =
    str(evaluation.evaluation_id) ?? str(evaluation.id) ?? null;
  const summary = evalSummaryOf(evaluation.summary);
  if (!evaluationId && !summary) return null;
  const status = str(evaluation.status);
  const model = str(evaluation.model);
  return {
    evaluationId,
    ...(status ? { status } : {}),
    ...(model ? { model } : {}),
    summary,
  };
}

/** How a case moved from baseline to candidate. */
export function caseTrend(
  result: EvalResult
): "improved" | "regressed" | "unchanged" | "unknown" {
  const before = result.baseline?.score;
  const after = result.candidate?.score;
  if (typeof before !== "number" || typeof after !== "number") return "unknown";
  if (after > before) return "improved";
  if (after < before) return "regressed";
  return "unchanged";
}

export function formatScore(score: number | null | undefined): string {
  return typeof score === "number" ? score.toFixed(1) : "–";
}

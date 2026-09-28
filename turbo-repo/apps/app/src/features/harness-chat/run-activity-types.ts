/** One thing the agent did during a run: a tool call, a consult or a
 * delegated brief (whose own tool calls are in `steps`). */
export interface RunActivityStep {
  id: string;
  tool: string;
  label: string;
  /** Arguments as the harness recorded them, redacted and bounded; null for
   * runs recorded before the harness kept them. */
  args: unknown;
  argsTruncated: boolean;
  preview: unknown;
  previewTruncated: boolean;
  ms: number | null;
  /** null when the run ended before the step did. */
  ok: boolean | null;
  error: string | null;
  startedAt: string;
  steps?: RunActivityStep[];
}

export interface RunActivityUsage {
  inputTokens: number;
  outputTokens: number;
  models: string[];
}

export interface RunActivity {
  runId: string;
  status: string;
  steps: RunActivityStep[];
  /** Steps in all, those inside delegations included. */
  stepCount: number;
  durationMs: number | null;
  usage: RunActivityUsage;
}

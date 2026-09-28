import type {
  HarnessEvent,
  HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";
import type { TrFn } from "@/features/i18n/i18n.service.types";
import type {
  RunActivity,
  RunActivityStep,
} from "@/features/harness-chat/run-activity-types";
import { stepLabel } from "../../stream/step-labels";

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const elapsed = (from: string, to: string): number | null => {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
};

const durationOf = (step: RunActivityStep, event: HarnessEvent) =>
  num(event.data.duration_ms) ?? elapsed(step.startedAt, event.created_at);

class ActivityBuilder {
  readonly steps: RunActivityStep[] = [];
  stepCount = 0;
  inputTokens = 0;
  outputTokens = 0;
  readonly models = new Set<string>();
  private readonly delegates = new Map<string, RunActivityStep>();
  private readonly byCallId = new Map<string, RunActivityStep>();
  private readonly open: {
    step: RunActivityStep;
    delegateId: string | null;
  }[] = [];
  private advisor: RunActivityStep | null = null;

  constructor(private readonly tr: TrFn) {}

  apply(event: HarnessEvent): void {
    switch (event.type) {
      case "tool.started":
        return this.toolStarted(event);
      case "tool.completed":
      case "tool.failed":
        return this.toolEnded(event);
      case "agent.started":
        return this.agentStarted(event);
      case "advisor.consulted":
        return this.advisorConsulted(event);
      case "delegate.completed":
        return this.delegateCompleted(event);
      case "usage.recorded":
        return this.usageRecorded(event);
      default:
        return;
    }
  }

  private newStep(tool: string, event: HarnessEvent): RunActivityStep {
    return {
      id: str(event.data.call_id) ?? event.id,
      tool,
      label: stepLabel(tool, this.tr),
      args: event.data.args ?? null,
      argsTruncated: event.data.args_truncated === true,
      preview: null,
      previewTruncated: false,
      ms: null,
      ok: null,
      error: null,
      startedAt: event.created_at,
    };
  }

  private delegateFor(event: HarnessEvent): RunActivityStep | null {
    const id = str(event.data.delegate_id);
    if (!id) return null;
    let step = this.delegates.get(id);
    if (!step) {
      step = { ...this.newStep("delegate", event), id, args: null, steps: [] };
      this.delegates.set(id, step);
      this.steps.push(step);
      this.stepCount += 1;
    }
    if (step.args === null && str(event.data.brief)) {
      step.args = { brief: event.data.brief };
    }
    return step;
  }

  private place(step: RunActivityStep, event: HarnessEvent): void {
    const parent = this.delegateFor(event);
    (parent?.steps ?? this.steps).push(step);
    this.stepCount += 1;
  }

  /** The open call an end event belongs to: by `call_id`, else the oldest
   * open call of the same tool (records from before the harness kept ids). */
  private takeOpen(event: HarnessEvent, tool: string): RunActivityStep | null {
    const callId = str(event.data.call_id);
    const delegateId = str(event.data.delegate_id);
    const index = callId
      ? this.open.findIndex((entry) => entry.step === this.byCallId.get(callId))
      : this.open.findIndex(
          (entry) => entry.step.tool === tool && entry.delegateId === delegateId
        );
    if (index < 0) return null;
    return this.open.splice(index, 1)[0].step;
  }

  private toolStarted(event: HarnessEvent): void {
    const tool = str(event.data.tool);
    if (!tool) return;
    const step = this.newStep(tool, event);
    this.place(step, event);
    this.open.push({ step, delegateId: str(event.data.delegate_id) });
    const callId = str(event.data.call_id);
    if (callId) this.byCallId.set(callId, step);
  }

  private toolEnded(event: HarnessEvent): void {
    const tool = str(event.data.tool);
    if (!tool) return;
    let step = this.takeOpen(event, tool);
    if (!step) {
      // Refused before it started (permissions, bad arguments).
      step = this.newStep(tool, event);
      this.place(step, event);
    }
    step.ms = durationOf(step, event);
    if (event.type === "tool.completed") {
      step.ok = true;
      step.preview = event.data.preview ?? null;
      step.previewTruncated = event.data.preview_truncated === true;
    } else {
      step.ok = false;
      step.error = str(event.data.error) ?? str(event.data.reason) ?? "";
    }
  }

  private agentStarted(event: HarnessEvent): void {
    if (event.data.agent !== "advisor") {
      this.delegateFor(event);
      return;
    }
    this.advisor = this.newStep("ask_advisor", event);
    this.place(this.advisor, event);
  }

  private advisorConsulted(event: HarnessEvent): void {
    const step = this.advisor;
    if (!step) return;
    step.ok = true;
    step.ms = elapsed(step.startedAt, event.created_at);
    step.preview = { signal: event.data.signal, note: event.data.note };
    this.advisor = null;
  }

  private delegateCompleted(event: HarnessEvent): void {
    const step = this.delegateFor(event);
    if (!step) return;
    step.ok = true;
    step.ms = durationOf(step, event);
    step.preview = {
      tools_run: event.data.tools_run,
      rows_returned: event.data.rows_returned,
      turns: event.data.turns,
    };
  }

  private usageRecorded(event: HarnessEvent): void {
    this.inputTokens += num(event.data.input_tokens) ?? 0;
    this.outputTokens += num(event.data.output_tokens) ?? 0;
    const model = str(event.data.model);
    if (model) this.models.add(model);
  }
}

/** The run's tool calls, consults and delegations in the order they started,
 * with its total duration and token usage. */
export function mapRunActivity(
  record: HarnessRunRecord,
  tr: TrFn
): RunActivity {
  const builder = new ActivityBuilder(tr);
  for (const event of record.events) builder.apply(event);

  const events = record.events;
  const first = events.find((e) => e.type === "run.started") ?? events[0];
  const last =
    events.findLast(
      (e) => e.type === "run.completed" || e.type === "run.failed"
    ) ?? events.at(-1);

  return {
    runId: record.run_id,
    status: record.status,
    steps: builder.steps,
    stepCount: builder.stepCount,
    durationMs:
      first && last ? elapsed(first.created_at, last.created_at) : null,
    usage: {
      inputTokens: builder.inputTokens,
      outputTokens: builder.outputTokens,
      models: [...builder.models],
    },
  };
}

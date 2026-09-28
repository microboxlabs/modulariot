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

/**
 * The run's tool calls, consults and delegations in the order they started.
 * Events are paired on `call_id`; records written before the harness kept it
 * are paired with the oldest open call of the same tool.
 */
export function mapRunActivity(
  record: HarnessRunRecord,
  tr: TrFn
): RunActivity {
  const top: RunActivityStep[] = [];
  const delegates = new Map<string, RunActivityStep>();
  const byCallId = new Map<string, RunActivityStep>();
  const open: { step: RunActivityStep; delegateId: string | null }[] = [];
  let advisor: RunActivityStep | null = null;
  let stepCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const models = new Set<string>();

  const newStep = (tool: string, event: HarnessEvent): RunActivityStep => ({
    id: str(event.data.call_id) ?? event.id,
    tool,
    label: stepLabel(tool, tr),
    args: event.data.args ?? null,
    argsTruncated: event.data.args_truncated === true,
    preview: null,
    previewTruncated: false,
    ms: null,
    ok: null,
    error: null,
    startedAt: event.created_at,
  });

  const delegateFor = (event: HarnessEvent): RunActivityStep | null => {
    const id = str(event.data.delegate_id);
    if (!id) return null;
    let step = delegates.get(id);
    if (!step) {
      step = { ...newStep("delegate", event), id, args: null, steps: [] };
      delegates.set(id, step);
      top.push(step);
      stepCount += 1;
    }
    if (step.args === null && str(event.data.brief)) {
      step.args = { brief: event.data.brief };
    }
    return step;
  };

  const place = (step: RunActivityStep, event: HarnessEvent) => {
    const parent = delegateFor(event);
    (parent?.steps ?? top).push(step);
    stepCount += 1;
  };

  const settle = (step: RunActivityStep, event: HarnessEvent, ok: boolean) => {
    step.ok = ok;
    step.ms =
      num(event.data.duration_ms) ?? elapsed(step.startedAt, event.created_at);
    if (ok) {
      step.preview = event.data.preview ?? null;
      step.previewTruncated = event.data.preview_truncated === true;
    } else {
      step.error = str(event.data.error) ?? str(event.data.reason) ?? "";
    }
  };

  const findOpen = (
    event: HarnessEvent,
    tool: string
  ): RunActivityStep | null => {
    const callId = str(event.data.call_id);
    const delegateId = str(event.data.delegate_id);
    const index = callId
      ? open.findIndex((entry) => entry.step === byCallId.get(callId))
      : open.findIndex(
          (entry) => entry.step.tool === tool && entry.delegateId === delegateId
        );
    if (index < 0) return null;
    return open.splice(index, 1)[0].step;
  };

  for (const event of record.events) {
    const tool = str(event.data.tool);
    switch (event.type) {
      case "tool.started": {
        if (!tool) break;
        const step = newStep(tool, event);
        place(step, event);
        open.push({ step, delegateId: str(event.data.delegate_id) });
        const callId = str(event.data.call_id);
        if (callId) byCallId.set(callId, step);
        break;
      }
      case "tool.completed":
      case "tool.failed": {
        if (!tool) break;
        const ok = event.type === "tool.completed";
        let step = findOpen(event, tool);
        if (!step) {
          // Refused before it started (permissions, bad arguments).
          step = newStep(tool, event);
          place(step, event);
        }
        settle(step, event, ok);
        break;
      }
      case "agent.started": {
        if (event.data.agent === "advisor") {
          advisor = newStep("ask_advisor", event);
          place(advisor, event);
        } else {
          delegateFor(event);
        }
        break;
      }
      case "advisor.consulted": {
        if (!advisor) break;
        advisor.ok = true;
        advisor.ms = elapsed(advisor.startedAt, event.created_at);
        advisor.preview = { signal: event.data.signal, note: event.data.note };
        advisor = null;
        break;
      }
      case "delegate.completed": {
        const step = delegateFor(event);
        if (!step) break;
        step.ok = true;
        step.ms =
          num(event.data.duration_ms) ??
          elapsed(step.startedAt, event.created_at);
        step.preview = {
          tools_run: event.data.tools_run,
          rows_returned: event.data.rows_returned,
          turns: event.data.turns,
        };
        break;
      }
      case "usage.recorded": {
        inputTokens += num(event.data.input_tokens) ?? 0;
        outputTokens += num(event.data.output_tokens) ?? 0;
        const model = str(event.data.model);
        if (model) models.add(model);
        break;
      }
      default:
        break;
    }
  }

  const events = record.events;
  const first = events.find((e) => e.type === "run.started") ?? events[0];
  const last =
    events.findLast(
      (e) => e.type === "run.completed" || e.type === "run.failed"
    ) ?? events.at(-1);

  return {
    runId: record.run_id,
    status: record.status,
    steps: top,
    stepCount,
    durationMs:
      first && last ? elapsed(first.created_at, last.created_at) : null,
    usage: { inputTokens, outputTokens, models: [...models] },
  };
}

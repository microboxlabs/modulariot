"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  FIELD,
  FIELD_ERROR,
} from "@/features/symptoms/maintainer/ui/response-block";
import ChannelIcon from "./channel-icon";
import type { SampleEvent, Simulation } from "./conversations-types";
import { channelLabel, minutesAfter } from "./rule-model";

function recipientName(to: Simulation["messages"][number]["to"]) {
  return typeof to === "string" ? to : to.name || to.address;
}

/** The simulated messages in time order: "t+0' WhatsApp · Juan Soto · text". */
export function SimulationTimeline({
  result,
  eventAt,
  d,
}: Readonly<{ result: Simulation; eventAt: string; d: I18nRecord }>) {
  if (!result.matches) {
    return (
      <p
        role="status"
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        {tr("simulationNoMatch", d)}
      </p>
    );
  }
  const messages = [...result.messages]
    .map((m) => ({ m, minute: minutesAfter(m.at, eventAt) }))
    .sort((a, b) => a.minute - b.minute || a.m.step - b.m.step);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {result.recipients.length === 1
          ? tr("simulationOneRecipient", d)
          : tr("simulationRecipients", d, {
              n: String(result.recipients.length),
            })}
      </p>
      {messages.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>{tr("simulationNoMessages", d)}</p>
      ) : (
        <ol
          aria-label={tr("simulationTimeline", d)}
          className="flex flex-col gap-3 border-l border-gray-200 pl-4 dark:border-gray-700"
        >
          {messages.map(({ m, minute }) => (
            <li
              key={`${m.step}-${recipientName(m.to)}-${m.channel}`}
              className="flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-12 shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {`t+${minute}'`}
                </span>
                <ChannelIcon channel={m.channel} size={5} />
                <span className="font-medium text-gray-900 dark:text-white">
                  {channelLabel(m.channel, d)}
                </span>
                <span className={MUTED}>·</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {recipientName(m.to)}
                </span>
                <span className={`text-xs ${MUTED}`}>
                  {tr("stepN", d, { n: String(m.step + 1) })}
                </span>
              </div>
              <p className="ml-14 whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                {m.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** "Simulación": a sample event in JSON, sent to the server, and the messages it would cause. */
export default function SimulationSection({
  initial,
  disabled,
  d,
  onSimulate,
}: Readonly<{
  /** The prefilled sample event. */
  initial: SampleEvent;
  disabled: boolean;
  d: I18nRecord;
  onSimulate: (event: SampleEvent) => Promise<Simulation>;
}>) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [result, setResult] = useState<{
    simulation: Simulation;
    at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    let event: SampleEvent;
    try {
      event = JSON.parse(text) as SampleEvent;
    } catch {
      setError(tr("simulationBadJson", d));
      return;
    }
    setError(null);
    setRunning(true);
    try {
      setResult({ simulation: await onSimulate(event), at: event.at });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
        {tr("simulationEvent", d)}
        <textarea
          rows={10}
          spellCheck={false}
          className={`${FIELD} font-mono text-xs ${error ? FIELD_ERROR : ""}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={disabled || running}
          onClick={() => void run()}
        >
          {running ? tr("simulating", d) : tr("simulate", d)}
        </Button>
        <button
          type="button"
          className={`text-sm hover:underline ${MUTED}`}
          onClick={() => {
            setText(JSON.stringify(initial, null, 2));
            setError(null);
          }}
        >
          {tr("simulationReset", d)}
        </button>
        <span className={`text-xs ${MUTED}`}>{tr("simulationHint", d)}</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {result && (
        <SimulationTimeline
          result={result.simulation}
          eventAt={result.at}
          d={d}
        />
      )}
    </div>
  );
}

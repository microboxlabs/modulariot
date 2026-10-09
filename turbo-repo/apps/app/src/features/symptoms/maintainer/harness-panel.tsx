"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { definitionKey } from "./maintainer-api";
import { Panel } from "./symptom-side-panels";

/** How often, and for how long, the sheet looks for the draft Harness writes. */
const POLL_MS = 5_000;
const POLL_FOR_MS = 3 * 60_000;

const EXAMPLES = ["harnessExampleActivation", "harnessExampleLevels"] as const;

/**
 * "Harness · Describe el cambio; tú decides": sends the owner's request to the
 * Harness chat, which saves its proposal as the draft. The sheet then shows the
 * draft with its changes marked, to publish or discard.
 */
export default function HarnessPanel({
  id,
  name,
  d,
}: Readonly<{ id: string; name: string; d: I18nRecord }>) {
  const harness = useHarnessChatContext();
  const [text, setText] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (poll.current) clearInterval(poll.current);
      if (stop.current) clearTimeout(stop.current);
    },
    []
  );

  const propose = () => {
    const request = text.trim();
    if (!request) return;
    harness.openWithMessage(
      tr("harnessChangePrompt", d, { name, id, text: request })
    );
    setText("");
    if (poll.current) clearInterval(poll.current);
    if (stop.current) clearTimeout(stop.current);
    poll.current = setInterval(() => void mutate(definitionKey(id)), POLL_MS);
    stop.current = setTimeout(() => {
      if (poll.current) clearInterval(poll.current);
      poll.current = null;
    }, POLL_FOR_MS);
  };

  return (
    <Panel title={tr("harnessPanelTitle", d)}>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("harnessPanelSub", d)}
        </p>
        <textarea
          aria-label={tr("harnessPanelTitle", d)}
          rows={3}
          maxLength={2000}
          value={text}
          placeholder={tr("harnessChangePlaceholder", d)}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!text.trim()}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            onClick={propose}
          >
            {tr("harnessPropose", d)}
          </button>
          {EXAMPLES.map((key) => (
            <button
              key={key}
              type="button"
              className="text-xs text-gray-500 hover:text-gray-900 hover:underline dark:hover:text-white"
              onClick={() => setText(trDynamic(`${key}Text`, d))}
            >
              {trDynamic(key, d)}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

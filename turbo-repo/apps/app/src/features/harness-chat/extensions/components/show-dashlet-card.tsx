"use client";

import { useEffect, type FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";
import type { ShowDashletArgs, ShowDashletResult } from "../show-dashlet";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";

const messageCardClass =
  "w-full max-w-[90%] rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";

/**
 * Renders a dashboard dashlet standalone inside a chat message — the same
 * `Component` the dashboard itself renders. Sizing, config overrides, and
 * the showInChat exclusion rule all live in dashlet-preview.tsx, shared
 * with the /dev/components gallery so the two views can't drift apart.
 *
 * There's no user response to collect here — this is informational, not a
 * question — so it auto-resolves the tool call on mount rather than
 * waiting on user input, purely to unblock the run (the toolkit registers
 * every extension as a human-in-the-loop tool today).
 */
export const ShowDashletCard: FC<ToolCallMessagePartProps<ShowDashletArgs, ShowDashletResult>> = ({
  args,
  result,
  addResult,
}) => {
  const tr = useHarnessChatTr();

  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = resolveDashletPreview(args.dashletId, args.config);

  if (resolved.status === "unknown") {
    return (
      <div className={messageCardClass}>
        {tr("harnessChat.ui.showDashlet.unknown", { id: args.dashletId })}
      </div>
    );
  }

  // Says so rather than rendering nothing. The `show_dashlet` schema only
  // offers showInChat-eligible ids, but nothing stops a model emitting one
  // outside that enum — and the demo trigger reaches this path directly by
  // naming any registered dashlet (see findNamedDashletId in the chat stream
  // route, whose comment already promises this notice). Silence here reads
  // as a broken chat: the tool call auto-resolved, so the run carries on
  // with only a generic acknowledgement and no trace of what was asked for.
  if (resolved.status === "excluded") {
    return (
      <div className={messageCardClass}>
        {tr("harnessChat.ui.showDashlet.unsupported", { name: resolved.name })}
      </div>
    );
  }

  const { Component, widget, heightPx } = resolved;
  return (
    <div
      className="w-full max-w-[90%] overflow-hidden rounded-lg"
      style={{ height: heightPx }}
    >
      <Component widget={widget} editMode={false} />
    </div>
  );
};

"use client";

import { useEffect, type FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";
import type { ShowDashletArgs, ShowDashletResult } from "../show-dashlet";

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
  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = resolveDashletPreview(args.dashletId, args.config);

  if (resolved.status === "unknown") {
    return (
      <div className={messageCardClass}>
        Unknown dashlet: {args.dashletId}
      </div>
    );
  }

  // Renders nothing at all — not even a notice. The tool call already
  // auto-resolved above, so the run isn't blocked; this dashlet's chat
  // preview attempt just leaves no visible trace.
  if (resolved.status === "excluded") return null;

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

"use client";

import type { FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { DEFAULT_HARNESS_EXTENSIONS } from "@/features/harness-chat/extensions";
import { ArtifactCard } from "@/features/harness-chat/extensions/components/show-artifact-card";
import {
  ARTIFACT_FILES,
  SHOW_ARTIFACT_TOOL,
  type ShowArtifactArgs,
} from "@/features/harness-chat/extensions/show-artifact-args";
import type { TranscriptPart } from "../transcript";

type ToolPart = Extract<TranscriptPart, { kind: "tool" }>;

/** Cards that render from their args and stored result alone. The artifact
 * card is drawn without its tool-call wrapper, which needs the chat runtime
 * for its save action. */
const READ_ONLY_CARDS = new Set([
  "ask_user_question",
  "show_dashlet",
  "request_approval",
  "show_share_link",
  "show_knowledge_change",
  "show_learning_eval",
]);

const noop = () => undefined;

function isArtifact(args: Record<string, unknown>): boolean {
  return (
    typeof args.kind === "string" &&
    args.kind in ARTIFACT_FILES &&
    typeof args.title === "string" &&
    typeof args.content === "string"
  );
}

/** The chat card for a stored tool call, or null when the share page has
 * none for it. Expects the harness-chat i18n and read-only providers. */
export function renderToolCard(part: ToolPart) {
  if (part.name === SHOW_ARTIFACT_TOOL) {
    return isArtifact(part.args) ? (
      <ArtifactCard artifact={part.args as unknown as ShowArtifactArgs} />
    ) : null;
  }
  if (!READ_ONLY_CARDS.has(part.name)) return null;
  const extension = DEFAULT_HARNESS_EXTENSIONS.find(
    (e) => e.toolName === part.name
  );
  if (!extension) return null;
  const Card = extension.render as FC<ToolCallMessagePartProps>;
  const props = {
    type: "tool-call",
    toolCallId: part.id,
    toolName: part.name,
    args: part.args,
    argsText: JSON.stringify(part.args),
    result: part.result,
    isError: part.isError,
    status: { type: "complete" },
    addResult: noop,
    resume: noop,
    respondToApproval: noop,
  } as unknown as ToolCallMessagePartProps;
  return <Card {...props} />;
}

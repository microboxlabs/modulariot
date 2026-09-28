"use client";

import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import type { HarnessExtension } from "@/features/harness-chat/harness-extension";

export type ExtensionVariant = {
  id: string;
  label: string;
  args: unknown;
};

/**
 * Named `args` variants per non-dashlet extension, used to render its real
 * card component here as a live preview. ask_user_question gets both shapes
 * it actually supports (single-select and multi-select) since the card
 * looks and behaves differently between them — same content as the real
 * demo triggers in route.ts, for consistency. show_dashlet is deliberately
 * not listed — it isn't a distinct visual component, it just routes to
 * rendering a dashlet, and every dashlet already has its own card below.
 */
const EXTENSION_PREVIEW_VARIANTS: Record<string, ExtensionVariant[]> = {
  ask_user_question: [
    {
      id: "ask_user_question-single",
      label: "ask_user_question (single-select)",
      args: {
        question: "Which environment should this run against?",
        description:
          "This determines which credentials and data source the harness will use.",
        options: [
          { label: "Staging", description: "Safe to experiment, seeded with sample data." },
          { label: "Production", description: "Live data — changes are real." },
          { label: "Local", description: "Your own machine, nothing shared." },
        ],
        allowMultiple: false,
        allowOther: true,
      },
    },
    {
      id: "ask_user_question-multiple",
      label: "ask_user_question (multi-select)",
      args: {
        question: "Which regions should this deploy to?",
        description: "You can pick more than one — the harness will fan out to each.",
        options: [
          { label: "North America", description: "us-east, us-west" },
          { label: "Europe", description: "eu-west, eu-central" },
          { label: "Asia-Pacific", description: "ap-southeast" },
        ],
        allowMultiple: true,
        allowOther: true,
      },
    },
  ],
  show_knowledge_change: [
    {
      id: "show_knowledge_change-edit",
      label: "show_knowledge_change (ws_edit)",
      args: {
        tool: "ws_edit",
        changes: [
          {
            path: "rules/loaded-trips.md",
            layer: "rule",
            id: "loaded-trips",
            target: null,
            op: "edit",
            version: 2,
            title: null,
            content: null,
            reason: "Define what a loaded trip is",
            diff: [
              "--- a/rules/loaded-trips.md",
              "+++ b/rules/loaded-trips.md",
              "@@ -1,3 +1,4 @@",
              " # Loaded trips",
              "-A loaded trip is a planned trip.",
              "+A loaded trip is one sent to the tracking database.",
              "+Status ADDED means it was added to the plan.",
              " ",
            ].join("\n"),
          },
        ],
      },
    },
  ],
  show_learning_eval: [
    {
      id: "show_learning_eval-done",
      label: "show_learning_eval (summary)",
      args: {
        evaluationId: null,
        status: "done",
        model: "default",
        summary: { baseline_avg: 2.3, candidate_avg: 4.1, improved: 3, regressed: 0, unchanged: 1 },
      },
    },
  ],
};

export function getExtensionVariants(extension: HarnessExtension): ExtensionVariant[] {
  return EXTENSION_PREVIEW_VARIANTS[extension.toolName] ?? [];
}

/**
 * Renders an extension's own card component with a variant's sample args —
 * only the fields each card component actually reads
 * (args/result/isError/addResult) need to be real; the rest of
 * ToolCallMessagePartProps is unused by any current render component, so
 * it's stubbed rather than hand-typed in full.
 */
export function ExtensionVariantPreview({
  extension,
  variant,
}: Readonly<{ extension: HarnessExtension; variant: ExtensionVariant }>) {
  const Render = extension.render;
  const props = {
    args: variant.args,
    result: undefined,
    isError: false,
    addResult: () => {},
    resume: () => {},
    respondToApproval: () => {},
    toolCallId: variant.id,
    toolName: extension.toolName,
    argsText: JSON.stringify(variant.args),
    type: "tool-call",
    status: { type: "complete" },
    isLast: false,
    parentId: "preview",
  } as unknown as ToolCallMessagePartProps;

  return <Render {...props} />;
}

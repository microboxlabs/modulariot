import type { HarnessExtension } from "../harness-extension";
import { ShowKnowledgeChangeCard } from "./components/show-knowledge-change-card";
import { ShowLearningEvalCard } from "./components/show-learning-eval-card";
import { ShowLearningViewCard } from "./components/show-learning-view-card";
import {
  SHOW_KNOWLEDGE_CHANGE_TOOL,
  type ShowKnowledgeChangeArgs,
} from "./knowledge-change-args";
import {
  SHOW_LEARNING_EVAL_TOOL,
  type ShowLearningEvalArgs,
} from "./learning-eval-args";
import {
  SHOW_LEARNING_VIEW_TOOL,
  type ShowLearningViewArgs,
} from "./learning-view-args";

type Empty = Record<string, never>;

export const showKnowledgeChangeExtension: HarnessExtension<
  ShowKnowledgeChangeArgs,
  Empty
> = {
  toolName: SHOW_KNOWLEDGE_CHANGE_TOOL,
  description:
    "What a knowledge or scratchpad write changed, as diffs. Sent by the relay, never by the model.",
  parameters: {
    type: "object",
    properties: {
      tool: { type: "string" },
      changes: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      truncated: { type: "boolean" },
    },
    required: ["tool", "changes"],
  },
  render: ShowKnowledgeChangeCard,
};

export const showLearningEvalExtension: HarnessExtension<
  ShowLearningEvalArgs,
  Empty
> = {
  toolName: SHOW_LEARNING_EVAL_TOOL,
  description:
    "A before/after evaluation of knowledge changes. Sent by the relay, never by the model.",
  parameters: {
    type: "object",
    properties: {
      evaluationId: { type: ["string", "null"] },
      status: { type: "string" },
      model: { type: ["string", "null"] },
      summary: { type: ["object", "null"] },
    },
    required: ["evaluationId"],
  },
  render: ShowLearningEvalCard,
};

export const showLearningViewExtension: HarnessExtension<
  ShowLearningViewArgs,
  Empty
> = {
  toolName: SHOW_LEARNING_VIEW_TOOL,
  description:
    "Opens the editable knowledge or a learning session's changes. Sent by the relay, never by the model.",
  parameters: {
    type: "object",
    properties: { view: { type: "string", enum: ["layers", "diff"] } },
    required: ["view"],
  },
  render: ShowLearningViewCard,
};

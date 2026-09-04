import type { HarnessExtension } from "../harness-extension";
import { AskUserQuestionCard } from "./components/ask-user-question-card";

export type AskUserQuestionOption = {
  label: string;
  description?: string;
};

export type AskUserQuestionArgs = {
  question: string;
  description?: string;
  options: AskUserQuestionOption[];
  allowMultiple?: boolean;
  allowOther?: boolean;
};

export type AskUserQuestionResult = {
  selected: string[];
  other?: string;
};

export const askUserQuestionExtension: HarnessExtension<
  AskUserQuestionArgs,
  AskUserQuestionResult
> = {
  toolName: "ask_user_question",
  description:
    "Ask the user a single- or multi-select question, with optional descriptions and a free-text 'Other' answer.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string" },
      description: { type: "string" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            description: { type: "string" },
          },
          required: ["label"],
        },
      },
      allowMultiple: { type: "boolean" },
      allowOther: { type: "boolean" },
    },
    required: ["question", "options"],
  },
  render: AskUserQuestionCard,
};

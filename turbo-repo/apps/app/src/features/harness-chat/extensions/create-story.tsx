import type { JSONSchema7 } from "json-schema";
import type { HarnessExtension } from "../harness-extension";
import { CreateStoryCard } from "./components/create-story-card";

export type CreateStoryArgs = {
  /** Story id, generated server-side so the chat confirmation and the
   * localStorage-backed storytelling list agree on the same
   * /storytelling/{id}. */
  id: string;
  /** Optional title; the store falls back to a generic one if omitted. */
  title?: string;
};

export type CreateStoryResult = Record<string, never>;

export const createStoryExtension: HarnessExtension<CreateStoryArgs, CreateStoryResult> = {
  toolName: "create_story",
  description:
    "Create a new AI-generated storytelling entry, available afterwards at /storytelling/{id}. " +
    "Renders nothing in the chat — the story itself lives on its own page, not as an inline element.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
    },
    required: ["id"],
  } satisfies JSONSchema7,
  render: CreateStoryCard,
};

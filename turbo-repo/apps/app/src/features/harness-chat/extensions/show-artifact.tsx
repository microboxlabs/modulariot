import type { HarnessExtension } from "../harness-extension";
import { ShowArtifactCard } from "./components/show-artifact-card";
import {
  SHOW_ARTIFACT_TOOL,
  type ShowArtifactArgs,
} from "./show-artifact-args";

export const showArtifactExtension: HarnessExtension<
  ShowArtifactArgs,
  Record<string, never>
> = {
  toolName: SHOW_ARTIFACT_TOOL,
  description:
    "Show a diagram (svg or mermaid), a markdown note or a small HTML page inline in the chat. " +
    "HTML runs in a sandboxed frame without network access.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      kind: { type: "string", enum: ["svg", "mermaid", "markdown", "html"] },
      title: { type: "string" },
      content: { type: "string" },
    },
    required: ["kind", "title", "content"],
  },
  render: ShowArtifactCard,
};

import type { Toolkit, ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { JSONSchema7 } from "json-schema";

/**
 * One structured message the harness can send instead of plain text — a
 * name it can call, the argument shape it must send, and the card that
 * renders it (and, for human-in-the-loop cards, collects the answer via
 * the render component's `addResult`).
 */
export type HarnessExtension<TArgs = any, TResult = any> = {
  toolName: string;
  description: string;
  parameters: JSONSchema7;
  render: ToolCallMessagePartComponent<TArgs, TResult>;
};

/**
 * Converts the extension list into the toolkit shape `Tools({ toolkit })`
 * expects. Every extension is registered as a human-in-the-loop tool — the
 * run pauses until its `render` component calls `addResult`.
 *
 * Memoize the result (keyed on `extensions`) before passing it to `Tools` —
 * a fresh object every render re-runs its registration effect for nothing.
 */
export function buildHarnessToolkit(extensions: HarnessExtension[]): Toolkit {
  return Object.fromEntries(
    extensions.map((extension) => [
      extension.toolName,
      {
        type: "human" as const,
        description: extension.description,
        parameters: extension.parameters,
        render: extension.render,
      },
    ])
  );
}

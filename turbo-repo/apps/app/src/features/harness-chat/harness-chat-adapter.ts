import type { ChatModelAdapter } from "@assistant-ui/react";

/**
 * Placeholder adapter so the panel is interactive before the harness
 * streaming endpoint is wired up (tracked as follow-up work).
 */
export const harnessChatAdapter: ChatModelAdapter = {
  async run({ abortSignal }) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    abortSignal.throwIfAborted();

    return {
      content: [
        {
          type: "text",
          text: "Harness chat is not wired up yet — this is a placeholder response.",
        },
      ],
    };
  },
};

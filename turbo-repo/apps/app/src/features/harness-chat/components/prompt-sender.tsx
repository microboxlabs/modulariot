"use client";

import { useAui } from "@assistant-ui/react";
import { useEffect, type FC } from "react";

/** Sends a message the panel asked for (a header menu action) into this
 * thread, as if the user had typed it. */
export const PromptSender: FC<{
  prompt: string | null;
  onSent: () => void;
}> = ({ prompt, onSent }) => {
  const aui = useAui();

  useEffect(() => {
    if (!prompt) return;
    aui.composer.setText(prompt);
    aui.composer.send();
    onSent();
  }, [prompt, aui, onSent]);

  return null;
};

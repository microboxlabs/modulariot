"use client";

import { useAui } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";
import type { PendingAttachment } from "../context/harness-chat-context";

/**
 * Adds `label` as an attachment chip on the active session's composer —
 * mirrors InitialMessageSender's shape, but calls `addAttachment` instead of
 * `setText`/`send`: it leaves the composer un-sent so the user can write
 * their own message around the reference.
 */
export const PendingAttachmentReceiver: FC<{
  attachment: PendingAttachment | null;
  onConsumed: () => void;
}> = ({ attachment, onConsumed }) => {
  const aui = useAui();
  const consumedRef = useRef<PendingAttachment | null>(null);

  useEffect(() => {
    // Parent clears the pending value to null right after we consume it.
    // Reset the guard on that pass so clicking "Ask Harness" for the *same*
    // component again isn't silently ignored forever.
    if (!attachment) {
      consumedRef.current = null;
      return;
    }
    if (consumedRef.current === attachment) return;
    consumedRef.current = attachment;
    const { label, text } = attachment;
    void aui.composer.addAttachment({
      type: "file",
      name: label,
      // Must match the accept list of a composed AttachmentAdapter (see
      // harness-chat-attachments.ts's SimpleTextAttachmentAdapter) — the
      // composer runtime validates CreateAttachment.contentType against it
      // even though it bypasses that adapter's add()/send() for us.
      contentType: "text/plain",
      content: [
        {
          type: "text",
          text: text ?? `Referencing the "${label}" component from the embedded dashboard.`,
        },
      ],
    });
    onConsumed();
  }, [attachment, aui, onConsumed]);

  return null;
};

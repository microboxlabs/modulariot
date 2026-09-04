"use client";

import { useAui } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";

/**
 * Adds `label` as an attachment chip on the active session's composer —
 * mirrors InitialMessageSender's shape, but calls `addAttachment` instead of
 * `setText`/`send`: it leaves the composer un-sent so the user can write
 * their own message around the reference.
 */
export const PendingAttachmentReceiver: FC<{
  label: string | null;
  onConsumed: () => void;
}> = ({ label, onConsumed }) => {
  const aui = useAui();
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!label || consumedRef.current === label) return;
    consumedRef.current = label;
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
          text: `Referencing the "${label}" component from the embedded dashboard.`,
        },
      ],
    });
    onConsumed();
  }, [label, aui, onConsumed]);

  return null;
};

import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
} from "@assistant-ui/react";
import type { TrFn } from "./context/harness-chat-i18n-context";

function getFileDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

class SimplePdfAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf";

  constructor(private readonly tr: TrFn) {}

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // The composer runtime already rejects anything not matching `accept`
    // (file.type) before this ever runs — nothing left to gate here except
    // size, since a large PDF gets fully base64-encoded into `content` and
    // held in message state / sent over the wire as-is.
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        this.tr("harnessChat.ui.composer.pdfTooLarge", {
          size: (file.size / (1024 * 1024)).toFixed(1),
          limit: String(MAX_PDF_BYTES / (1024 * 1024)),
        }),
      );
    }
    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "file",
          filename: attachment.name,
          mimeType: attachment.contentType ?? "application/pdf",
          data: await getFileDataURL(attachment.file),
        },
      ],
    };
  }

  async remove() {
    // Content is a data URL embedded directly in the sent message — there's
    // no blob URL or server-side storage to release.
  }
}

export function createHarnessAttachmentAdapter(tr: TrFn): CompositeAttachmentAdapter {
  return new CompositeAttachmentAdapter([
    new SimpleImageAttachmentAdapter(),
    new SimplePdfAttachmentAdapter(tr),
    // Also covers synthetic "component reference" attachments (see
    // pending-attachment-receiver.tsx), which use contentType: "text/plain"
    // and go straight in as an already-complete CreateAttachment — this
    // adapter's add/send never actually run for those, but its `accept`
    // entry is what lets the composer's type check pass, and its `remove`
    // (a no-op, like the others here) is what runs if the user un-attaches it.
    new SimpleTextAttachmentAdapter(),
  ]);
}

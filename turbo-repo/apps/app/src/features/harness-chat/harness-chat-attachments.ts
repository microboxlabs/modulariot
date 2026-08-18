import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
} from "@assistant-ui/react";

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

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // The composer runtime already rejects anything not matching `accept`
    // (file.type) before this ever runs — nothing left to gate here except
    // size, since a large PDF gets fully base64-encoded into `content` and
    // held in message state / sent over the wire as-is.
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        `PDF is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) — the limit is ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
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

export const harnessAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimplePdfAttachmentAdapter(),
]);

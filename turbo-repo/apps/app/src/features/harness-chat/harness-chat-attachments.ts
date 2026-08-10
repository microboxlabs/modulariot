import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  generateId,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
} from "@assistant-ui/react";

function getFileDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

class SimplePdfAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: generateId(),
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

  async remove() {}
}

export const harnessAttachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimplePdfAttachmentAdapter(),
]);

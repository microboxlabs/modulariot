import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  type Attachment,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
} from "@assistant-ui/react";
import type { TrFn } from "./context/harness-chat-i18n-context";

/** The harness takes at most this many files per message, each this size. */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Image types every model provider the harness talks to accepts. */
const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const TEXT_TYPES =
  "text/plain,text/markdown,text/csv,text/html,text/xml,text/css,application/json";

function getFileDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

class ImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
  override accept = IMAGE_TYPES;

  /** Carries the file name along, so the model and the replayed history can
   * refer to the image by it. */
  override async send(
    attachment: PendingAttachment
  ): Promise<CompleteAttachment> {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "image",
          image: await getFileDataURL(attachment.file),
          filename: attachment.name,
        },
      ],
    };
  }
}

/** Sends the file as a data URL `file` part, which reaches the relay as a
 * document the harness reads. */
class FileAttachmentAdapter implements AttachmentAdapter {
  constructor(
    readonly accept: string,
    private readonly fallbackMime: string
  ) {}

  async add({ file }: { file: File }): Promise<PendingAttachment> {
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
          mimeType: attachment.contentType || this.fallbackMime,
          data: await getFileDataURL(attachment.file),
        },
      ],
    };
  }

  async remove() {
    // The content is a data URL in the message; nothing to release.
  }
}

/**
 * Applies the harness's limits before a file joins the composer: files are
 * base64-encoded into the message, so a large one would be held in state and
 * sent on every run before the harness rejected it.
 */
export class CappedAttachmentAdapter implements AttachmentAdapter {
  accept: string;

  constructor(
    private readonly inner: AttachmentAdapter,
    private readonly tr: TrFn,
    private readonly attachedCount: () => number
  ) {
    this.accept = inner.accept;
  }

  add(state: { file: File }) {
    const { file } = state;
    if (this.attachedCount() >= MAX_ATTACHMENTS) {
      throw new Error(
        this.tr("harnessChat.ui.composer.tooManyAttachments", {
          limit: String(MAX_ATTACHMENTS),
        })
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        this.tr("harnessChat.ui.composer.attachmentTooLarge", {
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1),
          limit: String(MAX_ATTACHMENT_BYTES / (1024 * 1024)),
        })
      );
    }
    return this.inner.add(state);
  }

  send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    return this.inner.send(attachment);
  }

  remove(attachment: Attachment): Promise<void> {
    return this.inner.remove(attachment);
  }
}

/** `attachedCount` reports how many files the composer already holds. */
export function createHarnessAttachmentAdapter(
  tr: TrFn,
  attachedCount: () => number
): CompositeAttachmentAdapter {
  const capped = (adapter: AttachmentAdapter) =>
    new CappedAttachmentAdapter(adapter, tr, attachedCount);
  return new CompositeAttachmentAdapter([
    capped(new ImageAttachmentAdapter()),
    capped(new FileAttachmentAdapter("application/pdf", "application/pdf")),
    // Text files go to the harness as files too, so a replayed turn carries
    // a marker instead of the whole file. Also covers synthetic "component
    // reference" attachments (see pending-attachment-receiver.tsx), which use
    // contentType "text/plain" and go straight in as an already-complete
    // attachment: this adapter's add/send never run for those, but its
    // `accept` lets the composer's type check pass and its `remove` runs if
    // the user un-attaches one.
    capped(new FileAttachmentAdapter(TEXT_TYPES, "text/plain")),
  ]);
}

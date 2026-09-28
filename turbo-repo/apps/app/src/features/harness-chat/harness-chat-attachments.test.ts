import { describe, expect, it } from "vitest";
import type { PendingAttachment } from "@assistant-ui/react";
import {
  createHarnessAttachmentAdapter,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
} from "./harness-chat-attachments";
import type { TrFn } from "./context/harness-chat-i18n-context";

const tr: TrFn = (path, params) => `${path} ${JSON.stringify(params ?? {})}`;

function file(name: string, type: string, size = 8): File {
  return new File([new Uint8Array(size)], name, { type });
}

async function add(count: number, f: File): Promise<PendingAttachment> {
  return (await createHarnessAttachmentAdapter(tr, () => count).add({
    file: f,
  })) as PendingAttachment;
}

describe("createHarnessAttachmentAdapter", () => {
  it("accepts only the image types every provider takes, PDFs and text", () => {
    const { accept } = createHarnessAttachmentAdapter(tr, () => 0);
    expect(accept).toContain("image/png");
    expect(accept).toContain("application/pdf");
    expect(accept).toContain("text/plain");
    expect(accept).not.toContain("image/*");
  });

  it("rejects a file over the size cap with a message naming it", async () => {
    await expect(
      add(0, file("big.png", "image/png", MAX_ATTACHMENT_BYTES + 1))
    ).rejects.toThrow(/attachmentTooLarge.*big\.png/);
  });

  it("rejects a file past the per-message limit", async () => {
    await expect(
      add(MAX_ATTACHMENTS, file("a.pdf", "application/pdf"))
    ).rejects.toThrow(/tooManyAttachments/);
  });

  it("sends an image as a data URL part that keeps its file name", async () => {
    const adapter = createHarnessAttachmentAdapter(tr, () => 0);
    const pending = (await adapter.add({
      file: file("chart.png", "image/png"),
    })) as PendingAttachment;
    const complete = await adapter.send(pending);
    expect(complete.content).toEqual([
      expect.objectContaining({ type: "image", filename: "chart.png" }),
    ]);
    const [part] = complete.content;
    expect(
      part.type === "image" && part.image.startsWith("data:image/png;base64,")
    ).toBe(true);
  });

  it("sends a PDF as a file part", async () => {
    const adapter = createHarnessAttachmentAdapter(tr, () => 0);
    const pending = await add(0, file("report.pdf", "application/pdf"));
    const complete = await adapter.send(pending);
    expect(complete.content).toEqual([
      expect.objectContaining({
        type: "file",
        filename: "report.pdf",
        mimeType: "application/pdf",
      }),
    ]);
  });
});

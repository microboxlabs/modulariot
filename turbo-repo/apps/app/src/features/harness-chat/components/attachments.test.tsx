import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SentAttachment } from "./attachments";

describe("sent attachment compatibility", () => {
  it("renders the filename while an attachment has no content yet", () => {
    render(
      <SentAttachment
        attachment={{
          id: "pending",
          type: "document",
          name: "report.pdf",
          status: { type: "running", reason: "uploading", progress: 0 },
          file: new File([], "report.pdf", { type: "application/pdf" }),
        }}
      />
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  it("preserves the download of a completed attachment", () => {
    render(
      <SentAttachment
        attachment={{
          id: "complete",
          type: "document",
          name: "report.pdf",
          status: { type: "complete" },
          content: [
            {
              type: "file",
              data: "data:application/pdf;base64,JVBERg==",
              mimeType: "application/pdf",
            },
          ],
        }}
      />
    );
    expect(screen.getByRole("link", { name: "report.pdf" })).toHaveAttribute(
      "href",
      "data:application/pdf;base64,JVBERg=="
    );
  });
});

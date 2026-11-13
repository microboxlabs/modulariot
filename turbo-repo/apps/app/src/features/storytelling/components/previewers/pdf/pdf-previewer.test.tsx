// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfThumbnail } from "./pdf-previewer";

const onUnhandledRejection = vi.fn();

async function flushRejections() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("PdfThumbnail", () => {
  beforeEach(() => {
    onUnhandledRejection.mockClear();
    process.on("unhandledRejection", onUnhandledRejection);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
    cleanup();
  });

  it.each([
    ["while mounted", false],
    ["after unmount", true],
  ])(
    "keeps the placeholder when getPage rejects %s",
    async (_case, unmountFirst) => {
      let rejectPage: (reason: unknown) => void = () => {};
      const pdf = {
        getPage: vi.fn(
          () =>
            new Promise((_resolve, reject) => {
              rejectPage = reject;
            })
        ),
      } as unknown as PDFDocumentProxy;

      const { container, unmount } = render(
        <PdfThumbnail
          pdf={pdf}
          pageNumber={1}
          width={120}
          active={false}
          onSelect={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      if (unmountFirst) unmount();

      rejectPage(new Error("Transport destroyed"));
      await flushRejections();

      expect(pdf.getPage).toHaveBeenCalledWith(1);
      expect(onUnhandledRejection).not.toHaveBeenCalled();
      expect(canvas.style.width).toBe("");
    }
  );
});

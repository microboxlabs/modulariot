import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaViewerItem } from "./media-inline-viewer";
import { useDocBlob } from "./use-doc-blob";

vi.mock("../media-source", () => ({
  useMediaSource: () => ({ contentUrl: (id: string) => `/content?doc=${id}` }),
}));

const NativeURL = URL;
const createUrl = vi.fn();
const revokeUrl = vi.fn();
const fetchFile = vi.fn();

function item(modifiedAt: string): MediaViewerItem {
  return {
    type: "document",
    file: {
      entry: { id: "doc", name: "proof.pdf", modifiedAt },
    } as MediaViewerItem["file"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchFile);
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("document preview revisions", () => {
  it("loads replacement bytes and releases obsolete and unmounted blob URLs", async () => {
    const first = new Blob(["first"], { type: "application/pdf" });
    const second = new Blob(["replacement"], { type: "application/pdf" });
    fetchFile
      .mockResolvedValueOnce({ ok: true, blob: async () => first })
      .mockResolvedValueOnce({ ok: true, blob: async () => second });
    createUrl
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const view = renderHook(({ current }) => useDocBlob(current, "doc"), {
      initialProps: { current: item("2026-10-26T10:00:00Z") },
    });
    await waitFor(() => expect(view.result.current.docUrl).toBe("blob:first"));
    view.rerender({ current: item("2026-10-26T10:01:00Z") });
    await waitFor(() => expect(fetchFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.result.current.docUrl).toBe("blob:second"));
    expect(fetchFile.mock.calls[0][0]).not.toBe(fetchFile.mock.calls[1][0]);
    expect(createUrl).toHaveBeenLastCalledWith(second);
    expect(revokeUrl).toHaveBeenCalledWith("blob:first");
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:second");
  });

  it("does not render an HTTP error body as a document", async () => {
    const body = vi.fn();
    fetchFile.mockResolvedValueOnce({ ok: false, blob: body });
    const view = renderHook(() =>
      useDocBlob(item("2026-10-26T10:00:00Z"), "doc")
    );
    await waitFor(() => expect(fetchFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.result.current.isDocLoading).toBe(false));
    expect(body).not.toHaveBeenCalled();
    expect(view.result.current.docUrl).toBeNull();
    view.unmount();
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { MediaViewerItem } from "../viewer/media-inline-viewer";
import { useImageReplace } from "./use-image-replace";

vi.mock("sonner", () => ({
  toast: { promise: vi.fn(), error: vi.fn() },
}));

const imageItem = {
  type: "image",
  file: { entry: { id: "node-img", name: "a.jpg" } },
} as unknown as MediaViewerItem;
const documentItem = {
  type: "document",
  file: { entry: { id: "node-doc", name: "b.pdf" } },
} as unknown as MediaViewerItem;

function setup(
  replace: (id: string, file: File) => Promise<unknown>,
  overrides: { refresh?: () => Promise<unknown> } = {}
) {
  const calls: string[] = [];
  const refresh = vi.fn(
    overrides.refresh ??
      (async () => {
        calls.push("refresh");
      })
  );
  const invalidateThumbnail = vi.fn(async (id: string) => {
    calls.push(`invalidate:${id}`);
  });
  const onImageReplaced = vi.fn(() => {
    calls.push("bump");
  });
  const src = { replace: vi.fn(replace) };
  const hook = renderHook(() =>
    useImageReplace({
      items: [imageItem, documentItem],
      dictionary: {},
      src,
      refresh,
      invalidateThumbnail,
      onImageReplaced,
    })
  );
  return { hook, calls, refresh, invalidateThumbnail, onImageReplaced, src };
}

const file = new File(["x"], "new.jpg", { type: "image/jpeg" });

async function replaceAt(
  hook: ReturnType<typeof setup>["hook"],
  index: number
) {
  act(() => hook.result.current.setEditImageIndex(index));
  expect(hook.result.current.editImageIndex).toBe(index);
  await act(() => hook.result.current.handleReplaceImage(file, index));
}

describe("useImageReplace", () => {
  beforeEach(() => {
    vi.mocked(toast.promise).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("handles a rejected replace without a second error toast and releases the modal state", async () => {
    const failure = new Error("Update failed");
    const { hook, refresh, invalidateThumbnail, onImageReplaced, src } = setup(
      () => Promise.reject(failure)
    );

    await replaceAt(hook, 0);

    expect(src.replace).toHaveBeenCalledTimes(1);
    expect(toast.promise).toHaveBeenCalledTimes(1);
    await expect(vi.mocked(toast.promise).mock.calls[0][0]).rejects.toBe(
      failure
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(invalidateThumbnail).not.toHaveBeenCalled();
    expect(onImageReplaced).not.toHaveBeenCalled();
    expect(hook.result.current.isUpdatingImage).toBe(false);
    expect(hook.result.current.editImageIndex).toBeNull();
  });

  it.each([
    {
      label: "an image bumps its thumbnail",
      index: 0,
      nodeId: "node-img",
      expected: ["refresh", "invalidate:node-img", "bump"],
    },
    {
      label: "a document leaves the thumbnail key alone",
      index: 1,
      nodeId: "node-doc",
      expected: ["refresh", "invalidate:node-doc"],
    },
  ])(
    "replaces once, then reloads in order: $label",
    async ({ index, nodeId, expected }) => {
      const { hook, calls, src } = setup(async () => ({ success: true }));

      await replaceAt(hook, index);

      expect(src.replace).toHaveBeenCalledTimes(1);
      expect(src.replace).toHaveBeenCalledWith(nodeId, file);
      expect(calls).toEqual(expected);
      expect(toast.promise).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
      expect(hook.result.current.isUpdatingImage).toBe(false);
      expect(hook.result.current.editImageIndex).toBeNull();
    }
  );

  it("logs a failed reload after a saved replace instead of contradicting the success toast", async () => {
    const reloadFailure = new Error("revalidation failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { hook, invalidateThumbnail, onImageReplaced } = setup(
      async () => ({ success: true }),
      {
        refresh: () => Promise.reject(reloadFailure),
      }
    );

    await replaceAt(hook, 0);

    expect(consoleError).toHaveBeenCalledWith(
      "Reloading the gallery after a replace failed",
      reloadFailure
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(invalidateThumbnail).not.toHaveBeenCalled();
    expect(onImageReplaced).not.toHaveBeenCalled();
    expect(hook.result.current.isUpdatingImage).toBe(false);
    expect(hook.result.current.editImageIndex).toBeNull();
    consoleError.mockRestore();
  });

  it("shows the error toast when replace throws before returning a promise", async () => {
    const { hook } = setup(() => {
      throw new Error("no source");
    });

    await replaceAt(hook, 0);

    expect(toast.promise).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("bento.multimedia.update_error");
    expect(hook.result.current.isUpdatingImage).toBe(false);
    expect(hook.result.current.editImageIndex).toBeNull();
  });

  it("refuses an index with no item and never calls replace", async () => {
    const { hook, src } = setup(async () => ({ success: true }));

    await act(() => hook.result.current.handleReplaceImage(file, 5));

    expect(src.replace).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("bento.multimedia.update_error");
  });
});

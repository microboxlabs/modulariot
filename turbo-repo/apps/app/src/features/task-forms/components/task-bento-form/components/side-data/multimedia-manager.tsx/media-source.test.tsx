import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";

const emptyPackage = { data: { list: { entries: [] } } };
const children = { data: emptyPackage, isLoading: false, mutate: vi.fn() };
const contents = { data: undefined, isLoading: false, mutate: vi.fn() };

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useOptimisticFileUpload: () => children,
  useGetNodeContents: () => contents,
  useGetNodeThumbnail: vi.fn(),
  useObservationTypes: vi.fn(),
}));

import { createAlfrescoSource } from "./media-source";

describe("createAlfrescoSource useFiles", () => {
  it("returns the same empty list on every render for a package without files", () => {
    const source = createAlfrescoSource("package-1");
    const { result, rerender } = renderHook(() => source.useFiles());
    const first = result.current.files;

    rerender();

    expect(first).toEqual([]);
    expect(result.current.files).toBe(first);
  });

  it("does not loop when a caller copies the files into state in an effect", () => {
    const source = createAlfrescoSource("package-1");
    let renders = 0;
    renderHook(() => {
      renders += 1;
      // Stop a loop here; otherwise act() spins until the worker runs out of memory.
      if (renders > 50) throw new Error("render loop");
      const { files } = source.useFiles();
      const [, setImages] = useState<unknown[]>([]);
      // The gallery does this; a new `files` array per render never settles.
      useEffect(() => {
        if (files) setImages([...files]);
      }, [files]);
    });

    expect(renders).toBeLessThan(10);
  });
});

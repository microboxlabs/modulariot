import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import type { AlfrescoFileEntry } from "./image.types";

const { useChildren, useContents } = vi.hoisted(() => ({
  useChildren: vi.fn(),
  useContents: vi.fn(),
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useOptimisticFileUpload: useChildren,
  useGetNodeContents: useContents,
  useGetNodeThumbnail: vi.fn(),
  useObservationTypes: vi.fn(),
}));

import { createAlfrescoSource } from "./media-source";

const file: AlfrescoFileEntry = {
  entry: {
    id: "file-1",
    name: "proof.pdf",
    createdAt: "2026-11-10T10:00:00Z",
    modifiedAt: "2026-11-10T10:00:00Z",
    createdByUser: { id: "user", displayName: "User" },
    modifiedByUser: { id: "user", displayName: "User" },
    isFile: true,
    isFolder: false,
    nodeType: "cm:content",
    parentId: "package-1",
  },
};
const otherFile = { entry: { ...file.entry, id: "file-2" } };
const emptyPackage = { data: { list: { entries: [] } } };
const populatedPackage = { data: { list: { entries: [file, otherFile] } } };

type Scenario = {
  name: string;
  packageId?: string;
  data?: { data?: { list?: { entries?: AlfrescoFileEntry[] } } };
  contentData?: { data: ({ error?: string } | null)[] };
  loading?: boolean;
  contentsLoading?: boolean;
  error?: Error;
  contentsError?: Error;
  expected: AlfrescoFileEntry[] | null;
};

const scenarios: Scenario[] = [
  {
    name: "loading children",
    packageId: "package-1",
    loading: true,
    expected: null,
  },
  {
    name: "children error",
    packageId: "package-1",
    error: new Error("failed"),
    expected: null,
  },
  { name: "no package", expected: null },
  {
    name: "no package with an empty content response",
    contentData: { data: [] },
    expected: [],
  },
  {
    name: "empty package",
    packageId: "package-1",
    data: emptyPackage,
    expected: [],
  },
  {
    name: "missing entries",
    packageId: "package-1",
    data: { data: {} },
    expected: [],
  },
  {
    name: "loading contents",
    packageId: "package-1",
    data: populatedPackage,
    contentsLoading: true,
    expected: null,
  },
  {
    name: "contents error",
    packageId: "package-1",
    data: populatedPackage,
    contentsError: new Error("failed"),
    expected: null,
  },
  {
    name: "files present",
    packageId: "package-1",
    data: populatedPackage,
    contentData: { data: [{}, {}] },
    expected: [file, otherFile],
  },
  {
    name: "failed file omitted",
    packageId: "package-1",
    data: populatedPackage,
    contentData: { data: [{}, { error: "failed" }] },
    expected: [file],
  },
  {
    name: "missing file omitted",
    packageId: "package-1",
    data: populatedPackage,
    contentData: { data: [null, {}] },
    expected: [otherFile],
  },
  {
    name: "all files failed",
    packageId: "package-1",
    data: populatedPackage,
    contentData: { data: [{ error: "failed" }, null] },
    expected: [],
  },
];

describe.each(scenarios)("createAlfrescoSource useFiles: $name", (scenario) => {
  beforeEach(() => {
    useChildren.mockReturnValue({
      data: scenario.data,
      isLoading: scenario.loading ?? false,
      error: scenario.error,
      mutate: vi.fn(),
    });
    useContents.mockReturnValue({
      data: scenario.contentData,
      isLoading: scenario.contentsLoading ?? false,
      error: scenario.contentsError,
      mutate: vi.fn(),
    });
  });

  it("returns the expected files with a stable reference across renders", () => {
    const source = createAlfrescoSource(scenario.packageId);
    const { result, rerender } = renderHook(() => source.useFiles());
    const first = result.current.files;

    rerender();
    rerender();

    expect(first).toEqual(scenario.expected);
    expect(result.current.files).toBe(first);
    expect(result.current.isLoading).toBe(
      Boolean(scenario.loading || scenario.contentsLoading)
    );
    expect(source.ready).toBe(Boolean(scenario.packageId));
    expect(useChildren).toHaveBeenLastCalledWith(scenario.packageId);
    expect(useContents).toHaveBeenLastCalledWith(
      scenario.data?.data?.list?.entries?.map((entry) => entry.entry.id) ?? []
    );
  });

  it("does not loop when a caller copies the files into state in an effect", () => {
    const source = createAlfrescoSource(scenario.packageId);
    let renders = 0;
    renderHook(() => {
      renders += 1;
      // Stop a loop here; otherwise act() spins until the worker runs out of memory.
      if (renders > 50) throw new Error("render loop");
      const { files } = source.useFiles();
      const [, setImages] = useState<AlfrescoFileEntry[]>([]);
      // The gallery does this; a new `files` array per render never settles.
      useEffect(() => {
        if (files) setImages([...files]);
      }, [files]);
    });

    expect(renders).toBeLessThan(10);
  });
});

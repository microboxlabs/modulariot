import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AlfrescoFileEntry } from "../image.types";
import MediaRow from "./media-row";
import ImageElement from "./image-element";

vi.mock("../media-source", () => ({
  useMediaSource: () => ({
    useThumbnail: () => ({ data: undefined }),
    useCategories: () => ({
      ORG_TYPE: { value: "ORG_TYPE", label: "Organization proof" },
    }),
    downloadUrl: () => "/download",
  }),
}));
vi.mock(
  "@/features/geographic-view/components/image-viewer/image-selector",
  () => ({
    ImageComponent: ({ tag }: { tag: string }) => <span>{tag}</span>,
  })
);

const file: AlfrescoFileEntry = {
  entry: {
    id: "doc",
    name: "proof.pdf",
    createdAt: "2026-10-26T10:00:00Z",
    modifiedAt: "2026-10-26T10:00:00Z",
    createdByUser: { id: "", displayName: "" },
    modifiedByUser: { id: "", displayName: "" },
    isFile: true,
    isFolder: false,
    nodeType: "trips:document",
    parentId: "trip",
    properties: { "mintral:contentType": "ORG_TYPE" },
  },
};

describe("organization document category labels", () => {
  it("uses the active source category in a document row", () => {
    render(
      <MediaRow
        file={file}
        index={0}
        type="document"
        onSelect={vi.fn()}
        dictionary={{}}
      />
    );
    expect(screen.getByText("Organization proof")).toBeInTheDocument();
  });
  it("uses the active source category in an image tile", () => {
    render(
      <ImageElement
        file={file}
        index={0}
        setSelectedImage={vi.fn()}
        dictionary={{}}
      />
    );
    expect(screen.getByText("Organization proof")).toBeInTheDocument();
  });
});

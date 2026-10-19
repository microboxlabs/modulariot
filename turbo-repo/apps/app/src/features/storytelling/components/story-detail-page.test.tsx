import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Story, StoryKind, StoryVersion } from "../storytelling.types";

const getStoryMock = vi.fn();
const openThread = vi.fn();
const openWithMessage = vi.fn();
const attachReference = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ lang: "es" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/layout/components/section-header/section-header", () => ({
  SectionHeader: ({
    leftContent,
    rightContent,
  }: {
    leftContent?: ReactNode;
    rightContent?: ReactNode;
  }) => (
    <div>
      {leftContent}
      {rightContent}
    </div>
  ),
}));

vi.mock("@/features/common/components/Breadcrumb/ClientBreadcrumb", () => ({
  ClientBreadcrumb: ({ path }: { path: { label: string }[] }) => (
    <nav>{path.map((p) => p.label).join(" / ")}</nav>
  ),
}));

vi.mock("@/features/harness-chat/context/harness-chat-context", () => ({
  useHarnessChatContext: () => ({
    openThread,
    openWithMessage,
    attachReference,
  }),
}));

vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="echart" />,
}));

vi.mock("./previewers/pdf/pdf-previewer", () => ({
  PdfPreviewer: ({ data }: { data: Uint8Array }) => (
    <div data-testid="pdf">{data.length} bytes</div>
  ),
}));

vi.mock("../stories-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stories-api")>()),
  getStory: (...args: unknown[]) => getStoryMock(...args),
}));

import StoryDetailPage from "./story-detail-page";

const dict = (es as unknown as I18nRecord).storytelling as I18nRecord;

function story(
  kind: StoryKind,
  version: Partial<StoryVersion>,
  extra: Partial<Story> = {}
): Story {
  return {
    id: "s1",
    title: "Weekly review",
    description: null,
    kind,
    ownerId: "u1",
    owned: true,
    permission: "owner",
    sourceThreadId: null,
    sourceMessageId: null,
    currentVersionId: "v1",
    createdAt: "2026-09-01T10:00:00Z",
    createdBy: "u1",
    updatedAt: "2026-09-01T10:00:00Z",
    updatedBy: "u1",
    sharedWith: [],
    currentVersion: {
      id: "v1",
      storyId: "s1",
      parentId: null,
      label: "v1",
      summary: null,
      contentType: null,
      content: null,
      metadata: null,
      createdAt: "2026-09-01T10:00:00Z",
      createdBy: "u1",
      ...version,
    },
    ...extra,
  };
}

function renderPage() {
  return render(<StoryDetailPage dict={dict} id="s1" rootDict={{}} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StoryDetailPage renders the current version by kind", () => {
  it("markdown", async () => {
    getStoryMock.mockResolvedValue(
      story("markdown", { content: "# Fleet summary\n\nAll good." })
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Fleet summary" })
    ).toBeInTheDocument();
  });

  it("html, in a sandboxed iframe fed through srcdoc", async () => {
    getStoryMock.mockResolvedValue(
      story("html", {
        content: "<html><head></head><body><p>Hello</p></body></html>",
      })
    );
    renderPage();
    const frame = (await screen.findByTitle(
      "Weekly review"
    )) as HTMLIFrameElement;
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("<p>Hello</p>");
  });

  it("svg, as an image", async () => {
    getStoryMock.mockResolvedValue(
      story("svg", {
        content:
          '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
      })
    );
    renderPage();
    const img = (await screen.findByAltText(
      "Weekly review"
    )) as HTMLImageElement;
    expect(img.src.startsWith("data:image/svg+xml")).toBe(true);
    expect(document.querySelector("script")).toBeNull();
  });

  it("deck, from the version's metadata", async () => {
    getStoryMock.mockResolvedValue(
      story("deck", {
        metadata: { slides: [{ type: "title", title: "Q3 results" }] },
      })
    );
    renderPage();
    expect((await screen.findAllByText("Q3 results")).length).toBeGreaterThan(
      0
    );
  });

  it("pdf, from base64 content", async () => {
    getStoryMock.mockResolvedValue(story("pdf", { content: btoa("%PDF-1.4") }));
    renderPage();
    expect(await screen.findByTestId("pdf")).toHaveTextContent("8 bytes");
  });

  it("sections: headings, metrics, charts and tables", async () => {
    getStoryMock.mockResolvedValue(
      story("sections", {
        metadata: {
          sections: [
            { type: "heading", text: "Overview" },
            { type: "metric", label: "Trips", value: 42 },
            { type: "chart", title: "Trend", option: { series: [] } },
            { type: "table", headers: ["Lane"], rows: [["North"]] },
          ],
        },
      })
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Overview" })
    ).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByTestId("echart")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "North" })).toBeInTheDocument();
  });

  it("says so when the version has no usable content", async () => {
    getStoryMock.mockResolvedValue(story("deck", { content: "not json" }));
    renderPage();
    expect(
      await screen.findByText(
        String(dict.detail && (dict.detail as I18nRecord).emptyContent)
      )
    ).toBeInTheDocument();
  });
});

describe("StoryDetailPage and the chat", () => {
  it("opens the source conversation and continues in a new chat", async () => {
    getStoryMock.mockResolvedValue(
      story("markdown", { content: "text" }, { sourceThreadId: "thread-7" })
    );
    renderPage();

    fireEvent.click(await screen.findByText("Abrir conversación"));
    expect(openThread).toHaveBeenCalledWith("thread-7");

    fireEvent.click(screen.getByText("Continuar en el chat"));
    expect(openWithMessage).toHaveBeenCalledWith(
      expect.stringContaining("Weekly review")
    );
    expect(openWithMessage).toHaveBeenCalledWith(expect.stringContaining("s1"));
  });

  it("offers no conversation link for a story made outside the chat", async () => {
    getStoryMock.mockResolvedValue(story("markdown", { content: "text" }));
    renderPage();
    await screen.findByText("Continuar en el chat");
    expect(screen.queryByText("Abrir conversación")).toBeNull();
  });

  it("hides owner actions from a reader", async () => {
    getStoryMock.mockResolvedValue(
      story(
        "markdown",
        { content: "text" },
        { owned: false, permission: "read" }
      )
    );
    renderPage();
    await screen.findByText("Continuar en el chat");
    expect(screen.queryByLabelText("Eliminar")).toBeNull();
    expect(screen.queryByLabelText("Compartir")).toBeNull();
    expect(screen.queryByLabelText("Renombrar")).toBeNull();
  });
});

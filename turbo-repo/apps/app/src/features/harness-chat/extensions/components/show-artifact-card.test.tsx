import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowArtifactArgs } from "../show-artifact-args";
import {
  ArtifactCard,
  ShowArtifactCard,
  artifactToStory,
  sandboxedHtml,
  sanitizeSvg,
} from "./show-artifact-card";

vi.mock("../../context/harness-chat-i18n-context", () => ({
  useHarnessChatTr: () => (key: string) => key,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ lang: "es" }),
}));

const toastSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: vi.fn(),
  },
}));

let storytellingEnabled = true;
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({
    ENABLE_STORYTELLING: storytellingEnabled ? "true" : "false",
  }),
}));

const saveMock = vi.fn();
vi.mock("@/features/storytelling/stories-api", () => ({
  saveArtifactAsStory: (...args: unknown[]) => saveMock(...args),
}));

vi.mock("../../context/harness-session-context", () => ({
  useHarnessThreadId: () => "thread-1",
}));

vi.mock("@assistant-ui/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@assistant-ui/react")>()),
  useAuiState: (select: (s: { message: { id: string } }) => unknown) =>
    select({ message: { id: "msg-1" } }),
}));

const hostileSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
  '<script>alert(1)</script><rect width="10" height="10" onclick="alert(2)"/>' +
  "<text>ok</text></svg>";

function artifact(
  kind: ShowArtifactArgs["kind"],
  content: string
): ShowArtifactArgs {
  return { id: "a1", kind, title: "Proceso de venta", content };
}

describe("sanitizeSvg", () => {
  it("removes scripts and handlers and keeps the drawing", () => {
    const clean = sanitizeSvg(hostileSvg);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("<rect");
    expect(clean).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

describe("ArtifactCard", () => {
  it("shows an SVG as an image of its sanitized markup", () => {
    render(<ArtifactCard artifact={artifact("svg", hostileSvg)} />);
    const img = screen.getByRole("img", { name: "Proceso de venta" });
    const markup = decodeURIComponent(img.getAttribute("src")!.split(",")[1]!);
    expect(markup).not.toContain("<script");
    expect(markup).toContain("<text>ok</text>");
    expect(document.querySelector("script")).toBeNull();
  });

  it("puts HTML in a sandboxed frame without same-origin", () => {
    render(
      <ArtifactCard
        artifact={artifact("html", "<html><head></head><body>hi</body></html>")}
      />
    );
    const frame = document.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame!.getAttribute("srcdoc")).toContain("Content-Security-Policy");
    expect(frame!.getAttribute("srcdoc")).toContain("<body>hi</body>");
  });

  it("renders markdown in the page", () => {
    render(
      <ArtifactCard artifact={artifact("markdown", "# Informe\n\nTexto")} />
    );
    expect(screen.getByRole("heading", { name: "Informe" })).toBeTruthy();
  });

  it("hides save as story until a handler is given", () => {
    const { rerender } = render(
      <ArtifactCard artifact={artifact("markdown", "x")} />
    );
    expect(
      screen.queryByLabelText("harnessChat.ui.showArtifact.saveAsStory")
    ).toBeNull();
    const onSave = vi.fn();
    rerender(
      <ArtifactCard
        artifact={artifact("markdown", "x")}
        onSaveAsStory={onSave}
      />
    );
    screen.getByLabelText("harnessChat.ui.showArtifact.saveAsStory").click();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("says when the content was not kept", () => {
    render(
      <ArtifactCard artifact={{ ...artifact("svg", ""), omitted: true }} />
    );
    expect(
      screen.getByText("harnessChat.ui.showArtifact.omitted")
    ).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ShowArtifactCard save as story", () => {
  const diagram = artifact("mermaid", "graph TD; A-->B");
  const card = () =>
    render(
      <ShowArtifactCard
        {...({
          args: diagram,
          result: {},
          addResult: vi.fn(),
        } as unknown as ComponentProps<typeof ShowArtifactCard>)}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
    storytellingEnabled = true;
  });

  it("keeps the artifact as a story from this chat, then offers to open it", async () => {
    saveMock.mockResolvedValue({ id: "s1" });
    card();

    screen.getByLabelText("harnessChat.ui.showArtifact.saveAsStory").click();

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    expect(saveMock).toHaveBeenCalledWith({
      title: "Proceso de venta",
      kind: "markdown",
      content: "```mermaid\ngraph TD; A-->B\n```\n",
      threadId: "thread-1",
      messageId: "msg-1",
    });
    const [message, options] = toastSuccessMock.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("harnessChat.ui.showArtifact.savedAsStory");
    expect(options.action.label).toBe("harnessChat.ui.showArtifact.openStory");
    options.action.onClick();
    expect(pushMock).toHaveBeenCalledWith("/es/storytelling/s1");
  });

  it("offers no save while storytelling is off", () => {
    storytellingEnabled = false;
    card();

    expect(
      screen.queryByLabelText("harnessChat.ui.showArtifact.saveAsStory")
    ).toBeNull();
  });
});

describe("artifactToStory", () => {
  it("keeps the story kinds as they are", () => {
    expect(artifactToStory(artifact("svg", "<svg/>"))).toEqual({
      title: "Proceso de venta",
      kind: "svg",
      content: "<svg/>",
    });
  });
});

describe("sandboxedHtml", () => {
  it("puts the policy before anything the page contains", () => {
    const doc = sandboxedHtml("<!-- <head> --><p>x</p>");
    expect(doc).toMatch(
      /^<!doctype html><meta http-equiv="Content-Security-Policy"[^>]*><!-- <head> --><p>x<\/p>$/
    );
    const parsed = new DOMParser().parseFromString(doc, "text/html");
    expect(
      parsed.head.querySelector('meta[http-equiv="Content-Security-Policy"]')
    ).not.toBeNull();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShowArtifactArgs } from "../show-artifact-args";
import { ArtifactCard, sandboxedHtml, sanitizeSvg } from "./show-artifact-card";

vi.mock("../../context/harness-chat-i18n-context", () => ({
  useHarnessChatTr: () => (key: string) => key,
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

  it("shows a wide diagram at its own size on request, scrolling in the card", () => {
    const wide =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 640"><rect width="10" height="10"/></svg>';
    render(<ArtifactCard artifact={artifact("svg", wide)} />);
    const toggle = screen.getByLabelText(
      "harnessChat.ui.showArtifact.actualSizeInline"
    );
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    const img = screen.getByRole("img", { name: "Proceso de venta" });
    expect(img.parentElement!.style.width).toBe("1800px");
    expect(img.parentElement!.parentElement!.className).toContain(
      "overflow-auto"
    );
  });

  it("opens a diagram in a pan and zoom view", () => {
    render(<ArtifactCard artifact={artifact("svg", hostileSvg)} />);
    fireEvent.click(
      screen.getByLabelText("harnessChat.ui.showArtifact.expand")
    );
    expect(screen.getByTestId("zoomable-area")).toBeTruthy();
    expect(
      screen.getByLabelText("harnessChat.ui.showArtifact.zoomIn")
    ).toBeTruthy();
  });

  it("offers the actual size toggle only for diagrams", () => {
    render(<ArtifactCard artifact={artifact("markdown", "x")} />);
    expect(
      screen.queryByLabelText("harnessChat.ui.showArtifact.actualSizeInline")
    ).toBeNull();
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

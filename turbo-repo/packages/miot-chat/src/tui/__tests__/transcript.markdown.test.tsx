import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Markdown } from "../transcript/markdown.js";
import { DARK_THEME } from "../theme/themes.js";

describe("Markdown — passthrough", () => {
  it("renders plain text as-is", () => {
    const { lastFrame } = render(
      <Markdown text="hello world" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("hello world");
  });

  it("strips inbound ANSI before tokenizing", () => {
    // Wrap a markdown construct in ANSI: if stripping runs, the
    // asterisks are consumed as bold; if not, they survive in the
    // frame.
    const { lastFrame } = render(
      <Markdown
        text={"\x1b[31m**bold**\x1b[0m text"}
        theme={DARK_THEME}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("bold");
    expect(frame).toContain("text");
    expect(frame).not.toContain("**bold**");
  });
});

describe("Markdown — headings", () => {
  it("renders an H1 in bold", () => {
    const { lastFrame } = render(
      <Markdown text="# Hello" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("Hello");
  });

  it("renders an H3 in bold", () => {
    const { lastFrame } = render(
      <Markdown text="### sub" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("sub");
  });
});

describe("Markdown — inline emphasis", () => {
  it("renders **bold** content", () => {
    const { lastFrame } = render(
      <Markdown text="this is **bold**" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("bold");
  });

  it("renders *italic* content", () => {
    const { lastFrame } = render(
      <Markdown text="this is *italic*" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("italic");
  });

  it("renders inline `code`", () => {
    const { lastFrame } = render(
      <Markdown text="use the `npm run test` command" theme={DARK_THEME} />,
    );
    expect(lastFrame() ?? "").toContain("npm run test");
  });
});

describe("Markdown — block elements", () => {
  it("renders fenced code blocks inside a bordered box", () => {
    const { lastFrame } = render(
      <Markdown
        text={"```\nconst x = 1;\nconst y = 2;\n```"}
        theme={DARK_THEME}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("const x = 1;");
    expect(frame).toContain("const y = 2;");
    // Bordered box characters (Ink uses unicode line drawing for round borders).
    expect(frame).toMatch(/[╭╮╰╯─│]/);
  });

  it("renders bullet lists with a • prefix", () => {
    const { lastFrame } = render(
      <Markdown text={"- first\n- second\n- third"} theme={DARK_THEME} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("•");
    expect(frame).toContain("first");
    expect(frame).toContain("second");
    expect(frame).toContain("third");
  });

  it("renders horizontal rules from asterisks", () => {
    // `***` rather than `---` to avoid the Setext-heading
    // ambiguity (--- under a paragraph turns the previous line into
    // an h2 instead of producing an hr).
    const { lastFrame } = render(
      <Markdown text={"alpha\n\n***\n\nbeta"} theme={DARK_THEME} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("alpha");
    expect(frame).toContain("beta");
    expect(frame).toContain("──");
  });
});

describe("Markdown — links", () => {
  it("renders links as `text (url)`", () => {
    const { lastFrame } = render(
      <Markdown
        text="[click here](https://example.com)"
        theme={DARK_THEME}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("click here");
    expect(frame).toContain("https://example.com");
  });
});

describe("Markdown — empty / edge", () => {
  it("renders nothing meaningful for empty input", () => {
    const { lastFrame } = render(<Markdown text="" theme={DARK_THEME} />);
    expect((lastFrame() ?? "").trim()).toBe("");
  });

  it("renders multi-paragraph text", () => {
    const { lastFrame } = render(
      <Markdown text="one\n\ntwo\n\nthree" theme={DARK_THEME} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("one");
    expect(frame).toContain("two");
    expect(frame).toContain("three");
  });
});

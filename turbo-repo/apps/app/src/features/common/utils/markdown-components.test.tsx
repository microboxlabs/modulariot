import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-components";

describe("MarkdownContent — document variant", () => {
  it("syntax-highlights a fenced code block with a language", () => {
    const { container } = render(
      <MarkdownContent variant="document">
        {"```ts\nexport const x: number = 1;\n```\n"}
      </MarkdownContent>
    );
    const code = container.querySelector("pre code");
    expect(code?.className).toContain("hljs");
    expect(code?.className).toContain("language-ts");
    // rehype-highlight wraps at least one token in a .hljs-* span
    expect(code?.querySelector('[class^="hljs-"]')).not.toBeNull();
  });

  it("leaves an unknown language (e.g. mermaid) intact for a custom renderer", () => {
    const { container } = render(
      <MarkdownContent variant="document">
        {"```mermaid\nflowchart LR\n  A --> B\n```\n"}
      </MarkdownContent>
    );
    const code = container.querySelector("pre code");
    expect(code?.className).toContain("language-mermaid");
    // ignoreMissing: no throw, and the source text survives as plain text
    expect(code?.textContent).toContain("flowchart LR");
  });

  it("merges a caller's component override over the built-ins", () => {
    const { container } = render(
      <MarkdownContent
        variant="document"
        components={{ pre: ({ children }) => <div data-testid="custom-pre">{children}</div> }}
      >
        {"```txt\nhello\n```\n"}
      </MarkdownContent>
    );
    expect(container.querySelector('[data-testid="custom-pre"]')).not.toBeNull();
  });
});

describe("MarkdownContent — compact variant (chat bubbles, spotlight)", () => {
  const table = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";

  it("renders a GFM table as a real <table>, not literal pipe text", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });

  it("scopes the table's own horizontal scroll instead of leaving it to the host", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    const wrapper = container.querySelector("table")?.parentElement;
    expect(wrapper?.className).toContain("overflow-x-auto");
  });

  it("wraps the table in the same card chrome as a code block", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    const wrapper = container.querySelector("table")?.parentElement;
    expect(wrapper?.className).toContain("bg-gray-50");
    expect(wrapper?.className).toContain("rounded-lg");
    expect(wrapper?.className).toContain("border");
  });

  it("keeps every cell on one line so a wide cell grows the table sideways, not vertically", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    expect(container.querySelector("table")?.className).toContain("whitespace-nowrap");
    for (const cell of container.querySelectorAll("th, td")) {
      expect(cell.className).toContain("whitespace-nowrap");
    }
  });

  it("draws a faint divider between columns on every row", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    for (const row of container.querySelectorAll("tr")) {
      expect(row.className).toContain("divide-x");
    }
  });

  it("highlights the header row with its own background and a darker bottom border", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    const thead = container.querySelector("thead")?.className;
    expect(thead).toContain("bg-gray-100");
    expect(thead).toContain("border-gray-300");
  });

  it("disables rubber-band bounce on the table's own horizontal scroll", () => {
    const { container } = render(<MarkdownContent>{table}</MarkdownContent>);
    const wrapper = container.querySelector("table")?.parentElement;
    expect(wrapper?.className).toContain("overscroll-x-none");
  });
});

describe("MarkdownContent — document variant tables", () => {
  const table = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";

  it("keeps every cell on one line, same as the compact variant", () => {
    const { container } = render(<MarkdownContent variant="document">{table}</MarkdownContent>);
    expect(container.querySelector("table")?.className).toContain("whitespace-nowrap");
    for (const cell of container.querySelectorAll("th, td")) {
      expect(cell.className).toContain("whitespace-nowrap");
    }
  });

  it("draws a faint divider between columns on every row", () => {
    const { container } = render(<MarkdownContent variant="document">{table}</MarkdownContent>);
    for (const row of container.querySelectorAll("tr")) {
      expect(row.className).toContain("divide-x");
    }
  });

  it("highlights the header row with its own background and a darker bottom border", () => {
    const { container } = render(<MarkdownContent variant="document">{table}</MarkdownContent>);
    expect(container.querySelector("thead")?.className).toContain("bg-gray-100");
    // The border override lives on the <article> (a prose-thead: variant,
    // not a plain className on <thead> — see MarkdownContent's comment).
    expect(container.querySelector("article")?.className).toContain(
      "prose-thead:border-gray-300"
    );
  });

  it("disables rubber-band bounce on the table's own horizontal scroll", () => {
    const { container } = render(<MarkdownContent variant="document">{table}</MarkdownContent>);
    const wrapper = container.querySelector("table")?.parentElement;
    expect(wrapper?.className).toContain("overscroll-x-none");
  });
});

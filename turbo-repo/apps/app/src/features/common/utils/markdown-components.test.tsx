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

import { describe, expect, it } from "vitest";
import { teamsMarkdown } from "./adaptive-card-view";

describe("teamsMarkdown", () => {
  it("keeps character references, as Teams shows them decoded, and escapes markup", () => {
    expect(teamsMarkdown("Admin &lt;admin&gt;")).toBe("Admin &lt;admin&gt;");
    expect(teamsMarkdown("<img src=x onerror=alert(1)> & co")).toBe(
      "&lt;img src=x onerror=alert(1)&gt; &amp; co"
    );
  });

  it("draws bold, web links and line breaks", () => {
    expect(teamsMarkdown("**Viaje** 1\n[ver](https://example.com/a)")).toBe(
      '<strong>Viaje</strong> 1<br><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">ver</a>'
    );
  });
});

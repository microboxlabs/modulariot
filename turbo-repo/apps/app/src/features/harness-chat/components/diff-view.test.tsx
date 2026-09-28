import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../context/harness-chat-i18n-context";
import {
  DiffView,
  hiddenBefore,
  parsePatch,
  unifiedPatch,
  withGitHeader,
} from "./diff-view";

function wrap(node: ReactNode) {
  return render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      {node}
    </HarnessChatI18nProvider>
  );
}

// What Python's difflib.unified_diff writes, lines joined with "\n".
const difflibDiff = [
  "--- a/rules/cargado.md",
  "+++ b/rules/cargado.md",
  "@@ -1,3 +1,4 @@",
  " # Cargado en modular",
  "-Un viaje cargado es uno planificado.",
  "+Un viaje cargado es uno enviado a la base gps.",
  "+Estado ADDED: agregado a la planificación.",
  " ",
  "",
].join("\n");

const longOld =
  Array.from({ length: 40 }, (_, i) => `línea ${i + 1}`).join("\n") + "\n";
const longNew = longOld.replace("línea 20\n", "línea veinte\n");

describe("withGitHeader", () => {
  it("puts a git header in front of a difflib diff", () => {
    expect(withGitHeader(difflibDiff, "rules/cargado.md").split("\n")[0]).toBe(
      "diff --git a/rules/cargado.md b/rules/cargado.md"
    );
  });

  it("adds file lines to a diff that starts at its first hunk", () => {
    const out = withGitHeader("@@ -1 +1 @@\n-a\n+b\n", "x.md").split("\n");
    expect(out.slice(0, 3)).toEqual([
      "diff --git a/x.md b/x.md",
      "--- a/x.md",
      "+++ b/x.md",
    ]);
  });

  it("keeps a git diff as it is", () => {
    const git = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n";
    expect(withGitHeader(git, "x")).toBe(git);
  });
});

describe("parsePatch", () => {
  it("reads a difflib diff into hunks", () => {
    const file = parsePatch(difflibDiff, "rules/cargado.md");
    expect(file?.hunks).toHaveLength(1);
    const types = file!.hunks[0].changes.map((c) => c.type);
    expect(types.filter((t) => t === "insert")).toHaveLength(2);
    expect(types.filter((t) => t === "delete")).toHaveLength(1);
  });

  it("is null for text that is not a diff", () => {
    expect(parsePatch("hola", "x")).toBeNull();
  });

  it("counts the lines folded before each hunk", () => {
    const file = parsePatch(unifiedPatch(longOld, longNew, "x.md"), "x.md")!;
    expect(hiddenBefore(file.hunks, 0)).toBe(16);
  });
});

describe("DiffView", () => {
  it("shows added and removed lines with their counts", () => {
    wrap(<DiffView diff={difflibDiff} path="rules/cargado.md" />);
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(
      document.querySelectorAll(".diff-code-insert").length
    ).toBeGreaterThanOrEqual(2);
    expect(
      document.querySelectorAll(".diff-code-delete").length
    ).toBeGreaterThanOrEqual(1);
    // Line numbers in the gutters.
    expect(document.querySelectorAll(".diff-gutter").length).toBeGreaterThan(0);
  });

  it("switches between unified and side-by-side", () => {
    wrap(<DiffView diff={difflibDiff} path="rules/cargado.md" />);
    expect(document.querySelector(".diff-unified")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Lado a lado"));
    expect(document.querySelector(".diff-split")).toBeTruthy();
    expect(screen.getByTitle("Lado a lado").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("wraps long lines until told not to", () => {
    const { container } = wrap(<DiffView diff={difflibDiff} />);
    expect(container.querySelector(".miot-diff-nowrap")).toBeNull();
    fireEvent.click(screen.getByLabelText("Ajustar líneas"));
    expect(container.querySelector(".miot-diff-nowrap")).toBeTruthy();
  });

  it("folds unchanged runs of two texts and shows them on request", () => {
    wrap(<DiffView oldText={longOld} newText={longNew} path="x.md" />);
    expect(screen.getByText(/16 líneas sin cambios/)).toBeTruthy();
    expect(screen.queryByText("línea 2")).toBeNull();
    fireEvent.click(screen.getByText(/16 líneas sin cambios/));
    expect(screen.getByText("línea 2")).toBeTruthy();
    expect(screen.queryByText(/líneas sin cambios/)).toBeNull();
  });

  it("says so when the texts are the same", () => {
    wrap(<DiffView oldText="a\n" newText="a\n" />);
    expect(screen.getByText("Sin cambios")).toBeTruthy();
  });

  it("says so when the diff cannot be read", () => {
    wrap(<DiffView diff="no es un diff" />);
    expect(screen.getByText("No se pudo mostrar el diff.")).toBeTruthy();
  });

  it("shows a whole new file as added lines", () => {
    wrap(<DiffView oldText="" newText={"uno\ndos\n"} path="rules/nuevo.md" />);
    expect(screen.getByText("+2")).toBeTruthy();
  });
});

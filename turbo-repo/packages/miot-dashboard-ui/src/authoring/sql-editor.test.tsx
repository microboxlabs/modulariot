// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { afterEach, expect, it, vi } from "vitest";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";

afterEach(cleanup);
it("locks real user commands and schema insertion while saving, and unlocks the same editor", () => {
  const ref = createRef<SqlEditorHandle>();
  const onChange = vi.fn();
  const props = {
    id: "demo-query",
    value: "SELECT 1",
    ariaLabel: "SQL",
    onChange,
  };
  const rendered = render(<SqlEditor {...props} ref={ref} />);
  const content = screen.getByRole("textbox", { name: "SQL" });
  const view = EditorView.findFromDOM(content)!;
  rendered.rerender(<SqlEditor {...props} ref={ref} readOnly />);
  expect(EditorView.findFromDOM(content)).toBe(view);
  expect(content.getAttribute("contenteditable")).toBe("false");
  expect(view.state.facet(EditorState.readOnly)).toBe(true);
  act(() => {
    insertNewlineAndIndent(view);
    ref.current!.insert("blocked");
  });
  expect(view.state.doc.toString()).toBe("SELECT 1");
  expect(onChange).not.toHaveBeenCalled();
  rendered.rerender(<SqlEditor {...props} ref={ref} readOnly={false} />);
  expect(content.getAttribute("contenteditable")).toBe("true");
  expect(view.state.facet(EditorState.readOnly)).toBe(false);
  act(() => ref.current!.insert("allowed"));
  expect(view.state.doc.toString()).toContain("allowed");
  expect(onChange).toHaveBeenCalledOnce();
});

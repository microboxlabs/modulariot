import { act, render, screen } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { describe, expect, it, vi } from "vitest";
import SqlCodeEditor from "./sql-code-editor";

describe("real SQL code editor", () => {
  it("associates the editable surface with the visible SQL label", () => {
    render(
      <>
        <label id="demo-sql-label">Demo SQL</label>
        <SqlCodeEditor
          id="demo-sql"
          ariaLabelledBy="demo-sql-label"
          value="SELECT 1"
          onChange={vi.fn()}
        />
      </>
    );
    expect(screen.getByRole("textbox", { name: "Demo SQL" })).toHaveTextContent(
      "SELECT 1"
    );
  });
  it("disables user commands when readOnly changes without recreating the document", () => {
    const onChange = vi.fn();
    const props = { id: "demo-sql", value: "SELECT 1", onChange };
    const rendered = render(<SqlCodeEditor {...props} />);
    const content = rendered.container.querySelector(
      ".cm-content"
    ) as HTMLElement;
    const view = EditorView.findFromDOM(content)!;
    rendered.rerender(<SqlCodeEditor {...props} readOnly />);
    expect(EditorView.findFromDOM(content)).toBe(view);
    expect(content).toHaveAttribute("contenteditable", "false");
    expect(view.state.facet(EditorState.readOnly)).toBe(true);
    act(() => {
      insertNewlineAndIndent(view);
    });
    expect(view.state.doc.toString()).toBe("SELECT 1");
    expect(onChange).not.toHaveBeenCalled();
    rendered.rerender(<SqlCodeEditor {...props} readOnly={false} />);
    expect(content).toHaveAttribute("contenteditable", "true");
    expect(view.state.facet(EditorState.readOnly)).toBe(false);
  });
  it("keeps parent values synchronized and reports edits through the latest callback", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const rendered = render(
      <SqlCodeEditor id="demo-sql" value="SELECT 1" onChange={first} />
    );
    rendered.rerender(
      <SqlCodeEditor id="demo-sql" value="SELECT 2" onChange={latest} />
    );
    const content = rendered.container.querySelector(
      ".cm-content"
    ) as HTMLElement;
    const view = EditorView.findFromDOM(content)!;
    expect(view.state.doc.toString()).toBe("SELECT 2");
    act(() =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "SELECT 3" },
      })
    );
    expect(latest).toHaveBeenLastCalledWith("SELECT 3");
    expect(first).not.toHaveBeenCalled();
    const destroy = vi.spyOn(view, "destroy");
    rendered.unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });
});

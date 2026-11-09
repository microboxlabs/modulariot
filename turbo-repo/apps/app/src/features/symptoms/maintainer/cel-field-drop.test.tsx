import { EditorView } from "@codemirror/view";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CelEditor from "./cel-editor";
import { dropField, FIELD_CARET_MIME } from "./cel-field-drop";
import { FieldsPanel } from "./fields-panel";
import type { DataSource } from "./maintainer-api";

const source: DataSource = {
  id: "gps",
  key: "gps_signal",
  tenantCode: null,
  name: "GPS",
  root: "signal",
  kind: "SIGNAL",
  cadence: null,
  fields: [
    {
      path: "signal.frame.events",
      label: "Eventos",
      type: "objects",
      unit: null,
      origin: "DEVICE",
      engineSupported: true,
    },
  ],
  samples: [],
};
const d = { insertField: "Insertar {path}", fieldFilter: "Filtrar campos" };
const text = 'signal.frame.events.exists(e, e.event_type == "")';
const original = "before after";

function transfer(caret = String(text.length - 2)) {
  const values = new Map([
    ["text/plain", text],
    [FIELD_CARET_MIME, caret],
  ]);
  return {
    getData: (type: string) =>
      values.get(type === "Text" ? "text/plain" : type) ?? "",
    setData: (type: string, value: string) => values.set(type, value),
  };
}

function editor(onChange = vi.fn()) {
  const rendered = render(
    <CelEditor value={original} onChange={onChange} fields={[]} />
  );
  const content = screen.getByLabelText("CEL");
  const view = EditorView.findFromDOM(content)!;
  return { ...rendered, content, view, onChange };
}

describe("dragging fields into the CEL editor", () => {
  beforeEach(() => {
    // JSDOM has no layout; the real editor still applies the drop transaction and selection.
    vi.spyOn(EditorView.prototype, "requestMeasure").mockImplementation(
      () => {}
    );
    vi.spyOn(EditorView.prototype, "posAtCoords").mockReturnValue(7);
  });
  afterEach(() => vi.restoreAllMocks());

  it("drops the tree's list condition at the pointer with the cursor inside its quotes", () => {
    const { content, view, onChange } = editor();
    render(<FieldsPanel source={source} d={d} />);
    fireEvent.change(screen.getByLabelText("Filtrar campos"), {
      target: { value: "events" },
    });
    view.dispatch({ selection: { anchor: original.length } });
    const dataTransfer = transfer("");
    fireEvent.dragStart(screen.getByLabelText("Insertar signal.frame.events"), {
      dataTransfer,
    });
    fireEvent.drop(content, { dataTransfer });
    expect(view.state.doc.toString()).toBe(`before ${text}after`);
    expect(view.state.selection.main.anchor).toBe(7 + text.length - 2);
    expect(view.state.selection.main.empty).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(`before ${text}after`);
    expect(view.hasFocus).toBe(true);
  });

  it("respects an editor that becomes read-only after mounting", () => {
    const { content, view, onChange, rerender } = editor();
    rerender(
      <CelEditor value={original} onChange={onChange} fields={[]} readOnly />
    );
    fireEvent.drop(content, { dataTransfer: transfer() });
    expect(view.state.doc.toString()).toBe(original);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("preserves CodeMirror's native handling for ordinary text drops", () => {
    const { content, view } = editor();
    fireEvent.drop(content, { dataTransfer: transfer("") });
    expect(view.state.doc.toString()).toBe(`before ${text}after`);
    expect(view.state.selection.main.from).toBe(7);
    expect(view.state.selection.main.to).toBe(7 + text.length);
  });

  it.each(["", "-1", "0.5", "NaN", String(text.length + 1)])(
    "leaves native drop handling to the editor for missing or invalid caret metadata %s",
    (caret) => {
      const { content, view } = editor();
      const event = createEvent.drop(content, {
        dataTransfer: transfer(caret),
      }) as DragEvent;
      expect(dropField(event, view)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      expect(view.state.doc.toString()).toBe(original);
    }
  );

  it("does not consume a drop outside the document", () => {
    vi.mocked(EditorView.prototype.posAtCoords).mockReturnValue(null);
    const { content, view } = editor();
    const event = createEvent.drop(content, {
      dataTransfer: transfer(),
    }) as DragEvent;
    expect(dropField(event, view)).toBe(false);
    expect(view.state.doc.toString()).toBe(original);
  });
});

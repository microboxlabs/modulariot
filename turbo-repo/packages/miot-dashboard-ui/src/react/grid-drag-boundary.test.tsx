// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DraggableCore } from "react-draggable";
import { DASHBOARD_DRAG_CANCEL_SELECTOR } from "../core/grid-interactions";
afterEach(cleanup);
it("allows a nested item's own drag while canceling its outer container", () => {
  const outer = vi.fn(),
    inner = vi.fn();
  const outerRef = { current: document.createElement("div") },
    innerRef = { current: document.createElement("div") };
  render(
    <DraggableCore
      nodeRef={outerRef}
      cancel={DASHBOARD_DRAG_CANCEL_SELECTOR}
      onStart={outer}
    >
      <div ref={outerRef}>
        <div className="nested-grid-wrapper">
          <DraggableCore
            nodeRef={innerRef}
            cancel={DASHBOARD_DRAG_CANCEL_SELECTOR}
            onStart={inner}
          >
            <div ref={innerRef} className="react-grid-item">
              <span>Nested handle</span>
            </div>
          </DraggableCore>
        </div>
      </div>
    </DraggableCore>,
  );
  fireEvent.mouseDown(screen.getByText("Nested handle"), {
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  expect(inner).toHaveBeenCalledTimes(1);
  expect(outer).not.toHaveBeenCalled();
  fireEvent.mouseUp(document);
});
it.each(["combobox", "searchbox", "spinbutton"])(
  "does not drag from a custom %s control",
  (role) => {
    const start = vi.fn(),
      nodeRef = { current: document.createElement("div") };
    render(
      <DraggableCore
        nodeRef={nodeRef}
        cancel={DASHBOARD_DRAG_CANCEL_SELECTOR}
        onStart={start}
      >
        <div ref={nodeRef}>
          <div role={role} aria-label="Host input" tabIndex={0}>
            Control
          </div>
        </div>
      </DraggableCore>,
    );
    fireEvent.mouseDown(screen.getByRole(role), { button: 0 });
    expect(start).not.toHaveBeenCalled();
  },
);

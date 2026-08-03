/**
 * A pending "release the cap" timeout from an expand must not fire after a rapid
 * collapse: without clearing it, it overwrites maxHeight back to "none" mid-collapse,
 * snapping the section back open even though it's supposed to stay collapsed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SidebarSection } from "./sidebar-section";

describe("SidebarSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays collapsed when collapsed again within the expand release-cap window", () => {
    render(
      <SidebarSection title="Columnas">
        <div>content</div>
      </SidebarSection>
    );

    const toggle = screen.getByRole("button", { name: /columnas/i });
    const content = toggle.parentElement?.querySelector<HTMLDivElement>(
      "div.overflow-hidden"
    );
    expect(content).not.toBeNull();

    fireEvent.click(toggle); // expand: schedules setMaxHeight("none") in 200ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(toggle); // collapse before the timeout fires

    act(() => {
      vi.advanceTimersByTime(200); // let the stale expand timeout, if any, fire
    });

    expect(content?.style.maxHeight).toBe("0px");
  });
});

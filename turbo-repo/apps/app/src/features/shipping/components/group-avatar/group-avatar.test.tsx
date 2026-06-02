import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupAvatar } from "./group-avatar";

// The Tooltip relies on floating-ui (ResizeObserver/positioning) which is not
// what we are testing here; render its children directly.
vi.mock("flowbite-react", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe("GroupAvatar", () => {
  it("renders initials from a two-word group name", () => {
    render(<GroupAvatar group={{ id: "GROUP_ops", name: "Operations Faena" }} />);
    expect(screen.getByText("OF")).toBeInTheDocument();
  });

  it("renders the first two letters for a single-word group name", () => {
    render(<GroupAvatar group={{ id: "GROUP_tower", name: "Tower" }} />);
    expect(screen.getByText("TO")).toBeInTheDocument();
  });

  it("exposes the full group name as an accessible label", () => {
    render(<GroupAvatar group={{ id: "g1", name: "Control Tower" }} />);
    expect(screen.getByLabelText("Control Tower")).toBeInTheDocument();
  });

  it("renders nothing when no group is provided", () => {
    const { container } = render(<GroupAvatar />);
    expect(container).toBeEmptyDOMElement();
  });
});

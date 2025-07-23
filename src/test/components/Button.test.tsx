import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Example Button component for testing
const Button = ({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
  >
    {children}
  </button>
);

describe("Button Component", () => {
  it("renders with children", () => {
    const handleClick = () => {};
    render(<Button onClick={handleClick}>Click me</Button>);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    const handleClick = () => {};
    render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("has correct CSS classes", () => {
    const handleClick = () => {};
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass(
      "px-4",
      "py-2",
      "bg-blue-500",
      "text-white",
      "rounded",
    );
  });
});

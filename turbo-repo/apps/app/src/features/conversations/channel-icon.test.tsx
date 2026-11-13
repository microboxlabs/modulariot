import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChannelIcon from "./channel-icon";

describe("ChannelIcon", () => {
  it("names the channel in text and keeps the tooltip", () => {
    render(<ChannelIcon channel="whatsapp" label="WhatsApp" />);
    const label = screen.getByText("WhatsApp");
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveAttribute("title", "WhatsApp");
    expect(label.parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("hides an unlabelled icon from assistive technology", () => {
    const { container } = render(<ChannelIcon channel="email" />);
    const icon = container.querySelector('[data-channel="email"]');
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveTextContent("");
  });
});

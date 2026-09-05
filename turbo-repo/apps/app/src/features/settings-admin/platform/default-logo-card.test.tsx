import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DefaultLogoCard from "./default-logo-card";

const dict = {
  defaultTitle: "Default logo",
  defaultDescription: "What every domain without an entry shows.",
  previewLight: "Light background",
  previewDark: "Dark background",
};

describe("DefaultLogoCard", () => {
  it("captions both grounds", () => {
    render(<DefaultLogoCard dict={dict} />);

    expect(screen.getByText("Light background")).toBeInTheDocument();
    expect(screen.getByText("Dark background")).toBeInTheDocument();
  });

  it("says what the default is for", () => {
    render(<DefaultLogoCard dict={dict} />);

    expect(screen.getByText("Default logo")).toBeInTheDocument();
    expect(
      screen.getByText("What every domain without an entry shows.")
    ).toBeInTheDocument();
  });

  it("draws the mark twice, once per ground", () => {
    const { container } = render(<DefaultLogoCard dict={dict} />);

    expect(container.querySelectorAll("figure")).toHaveLength(2);
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("pins each half to its own brand palette, not the page's", () => {
    const { container } = render(<DefaultLogoCard dict={dict} />);

    // Without this the light swatch inherits the dark ink in dark mode and
    // renders near-white on white. The values themselves stay in globals.css.
    expect(container.querySelector(".brand-ground-light")).not.toBeNull();
    expect(container.querySelector(".brand-ground-dark")).not.toBeNull();
  });

  it("offers nothing to edit — changing the default is a release", () => {
    render(<DefaultLogoCard dict={dict} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

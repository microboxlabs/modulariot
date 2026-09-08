import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DomainLogo from "./domain-logo";

const LIGHT = "/app/api/branding/logo?v=abc";
const DARK = "/app/api/branding/logo?v=def&variant=dark";

describe("DomainLogo", () => {
  it("renders one image when the domain ships a single logo", () => {
    render(<DomainLogo logoUrl={LIGHT} />);

    const images = screen.getAllByAltText("Organization logo");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", LIGHT);
  });

  it("renders both when the domain ships a dark variant", () => {
    render(<DomainLogo logoUrl={LIGHT} logoUrlDark={DARK} />);

    const sources = screen
      .getAllByAltText("Organization logo")
      .map((image) => image.getAttribute("src"));
    expect(sources).toEqual([LIGHT, DARK]);
  });

  it("lets CSS pick, so the right logo is in the first paint", () => {
    render(<DomainLogo logoUrl={LIGHT} logoUrlDark={DARK} />);

    const [light, dark] = screen.getAllByAltText("Organization logo");
    // Hidden in dark mode, and hidden until dark mode, respectively.
    expect(light.className).toContain("dark:hidden");
    expect(dark.className).toContain("hidden");
    expect(dark.className).toContain("dark:block");
  });

  it("keeps the caller's sizing on both", () => {
    render(
      <DomainLogo
        logoUrl={LIGHT}
        logoUrlDark={DARK}
        className="mr-3 h-8 object-contain"
      />,
    );

    for (const image of screen.getAllByAltText("Organization logo")) {
      expect(image.className).toContain("object-contain");
    }
  });

  it("treats a null dark URL as no dark variant", () => {
    render(<DomainLogo logoUrl={LIGHT} logoUrlDark={null} />);

    expect(screen.getAllByAltText("Organization logo")).toHaveLength(1);
  });

  it("distinguishes the two in the test id, so a test can name one", () => {
    render(<DomainLogo logoUrl={LIGHT} logoUrlDark={DARK} testId="org-logo" />);

    expect(screen.getByTestId("org-logo")).toHaveAttribute("src", LIGHT);
    expect(screen.getByTestId("org-logo-dark")).toHaveAttribute("src", DARK);
  });

  it("uses the alt text the caller translated", () => {
    render(
      <DomainLogo logoUrl={LIGHT} logoUrlDark={DARK} alt="Logo de la organización" />,
    );

    expect(screen.getAllByAltText("Logo de la organización")).toHaveLength(2);
  });
});

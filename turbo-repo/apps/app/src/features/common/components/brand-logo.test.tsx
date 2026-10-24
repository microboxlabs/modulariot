import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Whatsapp } from "flowbite-react-icons/solid";
import { BrandLogo } from "./brand-logo";

/**
 * The logo contract: light/dark/default fallbacks, format-agnostic sources, and
 * the basePath prefix a raw <img> does not get for free.
 *
 * Next inlines NEXT_PUBLIC_BASE_PATH at build time from next.config.mjs; under
 * vitest it has to be stubbed, which is also what pins the prefixing behaviour.
 */
describe("BrandLogo", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("renders a single image when one asset covers both themes", () => {
    render(
      <BrandLogo
        logo={{ default: "/credential-logos/azure-entra.svg" }}
        alt="Azure Entra ID"
      />
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute(
      "src",
      "/app/credential-logos/azure-entra.svg"
    );
  });

  it("renders a theme-switched pair when light and dark differ", () => {
    const { container } = render(
      <BrandLogo
        logo={{
          light: "/credential-logos/oauth2-light.svg",
          dark: "/credential-logos/oauth2-dark.svg",
        }}
        alt="OAuth 2.0"
      />
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveClass("block", "dark:hidden");
    expect(images[1]).toHaveClass("hidden", "dark:block");
    // The dark twin is decorative — only one image carries the accessible name.
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("falls back to default for the theme variant that is missing", () => {
    const { container } = render(
      <BrandLogo
        logo={{
          dark: "/credential-logos/oauth2-dark.svg",
          default: "/credential-logos/credential-default.png",
        }}
        alt="Partial"
      />
    );

    const images = container.querySelectorAll("img");
    expect(images[0]).toHaveAttribute(
      "src",
      "/app/credential-logos/credential-default.png"
    );
    expect(images[1]).toHaveAttribute(
      "src",
      "/app/credential-logos/oauth2-dark.svg"
    );
  });

  it("falls back to the built-in key mark when a type ships no logo", () => {
    render(<BrandLogo alt="Unknown type" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/app/credential-logos/credential-default.png"
    );
  });

  it("serves bare paths when no basePath is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    render(<BrandLogo alt="No base path" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/credential-logos/credential-default.png"
    );
  });

  it("leaves absolute and data URLs unprefixed", () => {
    const { container } = render(
      <BrandLogo
        logo={{
          light: "https://cdn.example.com/brand.png",
          dark: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        }}
        alt="Remote"
      />
    );

    const images = container.querySelectorAll("img");
    expect(images[0]).toHaveAttribute(
      "src",
      "https://cdn.example.com/brand.png"
    );
    expect(images[1]).toHaveAttribute(
      "src",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
    );
  });

  it("draws a library icon in gray instead of an image", () => {
    render(
      <BrandLogo icon={Whatsapp} keyline="circle" alt="WhatsApp" size={40} />
    );

    const icon = screen.getByRole("img", { name: "WhatsApp" });
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("width", "34");
    expect(icon.parentElement).toHaveAttribute("data-keyline", "circle");
    expect(icon.getAttribute("class")).toContain("text-gray-600");
  });
});

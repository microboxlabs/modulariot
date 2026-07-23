import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CredentialTypeLogo } from "./credential-type-logo";

/**
 * The logo contract: light/dark/default fallbacks, format-agnostic sources, and
 * the basePath prefix a raw <img> does not get for free.
 *
 * Next inlines NEXT_PUBLIC_BASE_PATH at build time from next.config.mjs; under
 * vitest it has to be stubbed, which is also what pins the prefixing behaviour.
 */
describe("CredentialTypeLogo", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("renders a single image when one asset covers both themes", () => {
    render(
      <CredentialTypeLogo
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
      <CredentialTypeLogo
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
      <CredentialTypeLogo
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
    render(<CredentialTypeLogo alt="Unknown type" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/app/credential-logos/credential-default.png"
    );
  });

  it("serves bare paths when no basePath is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    render(<CredentialTypeLogo alt="No base path" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/credential-logos/credential-default.png"
    );
  });

  it("leaves absolute and data URLs unprefixed", () => {
    const { container } = render(
      <CredentialTypeLogo
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceCategoryBadge } from "./service-category-badge";

const useServiceCategoryName = vi.fn();

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useServiceCategoryName: (code: string | null | undefined) =>
    useServiceCategoryName(code),
}));

describe("ServiceCategoryBadge", () => {
  beforeEach(() => {
    useServiceCategoryName.mockReset();
  });

  it("renders the category initials and a tooltip with the full name", () => {
    useServiceCategoryName.mockReturnValue({
      name: "Servicio Programado",
      isLoading: false,
    });
    render(<ServiceCategoryBadge code="ST001" />);
    const badge = screen.getByText("SP");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Servicio Programado");
  });

  it("prefixes the tooltip with the provided label", () => {
    useServiceCategoryName.mockReturnValue({
      name: "Servicio Programado",
      isLoading: false,
    });
    render(
      <ServiceCategoryBadge code="ST001" tooltipLabel="Categoría de servicio" />
    );
    expect(screen.getByText("SP")).toHaveAttribute(
      "title",
      "Categoría de servicio: Servicio Programado"
    );
  });

  it("renders nothing when the code cannot be resolved", () => {
    useServiceCategoryName.mockReturnValue({
      name: undefined,
      isLoading: false,
    });
    const { container } = render(<ServiceCategoryBadge code="ST404" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no code is provided", () => {
    useServiceCategoryName.mockReturnValue({
      name: undefined,
      isLoading: false,
    });
    const { container } = render(<ServiceCategoryBadge code={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HiOutlinePhone } from "react-icons/hi";
import QuotaBar from "./quota-bar";
import { UsageBreakdownCard, UsageQuotaCard } from "./usage-card";

describe("shared usage cards", () => {
  it("colors the bar by level and caps its width", () => {
    const { container } = render(
      <QuotaBar used={150} quota={100} alertPct={80} />
    );
    const fill = container.querySelector("[data-level]") as HTMLElement;
    expect(fill.dataset.level).toBe("exhausted");
    expect(fill.style.width).toBe("100%");
  });

  it("shows used against the quota with its unit and footer", () => {
    render(
      <UsageQuotaCard
        icon={HiOutlinePhone}
        title="Minutos"
        description="d"
        used={40}
        quota={100}
        unit="minutos"
        alertPct={80}
        unavailable="none"
        footer="Quedan 60"
      />
    );
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("/ 100 minutos")).toBeInTheDocument();
    expect(screen.getByText("Quedan 60")).toBeInTheDocument();
  });

  it("says the quota is unavailable without one, and no number", () => {
    render(
      <UsageQuotaCard
        icon={HiOutlinePhone}
        title="Cuota"
        description="d"
        used={0}
        quota={null}
        unit="consultas"
        alertPct={80}
        unavailable="Sin cuota"
        footer="never"
      />
    );
    expect(screen.getByText("Sin cuota")).toBeInTheDocument();
    expect(screen.queryByText("never")).not.toBeInTheDocument();
  });

  it("aligns number columns right and shows the empty text without rows", () => {
    const { rerender } = render(
      <UsageBreakdownCard
        icon={HiOutlinePhone}
        title="Por destino"
        empty="Nada"
        columns={[{ label: "Destino" }, { label: "Minutos", align: "right" }]}
        rows={[{ key: "m", cells: ["Móvil", 12] }]}
      />
    );
    expect(screen.getByText("12")).toHaveClass("text-right");
    rerender(
      <UsageBreakdownCard
        icon={HiOutlinePhone}
        title="Por destino"
        empty="Nada"
        columns={[{ label: "Destino" }]}
        rows={[]}
      />
    );
    expect(screen.getByText("Nada")).toBeInTheDocument();
  });
});

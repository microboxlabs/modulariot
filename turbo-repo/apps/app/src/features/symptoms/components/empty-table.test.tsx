import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SymptomConstellationCounts } from "../types/symptoms";
import EmptyTable from "./empty-table";

const DICT: I18nRecord = {
  symptoms: {
    no_active_conditions: "Sin condiciones activas por este momento",
    normal_operation: "La flota se encuentra operando con normalidad.",
    check_later: "Vuelve más tarde.",
    code_black: "Código negro",
    critical_condition: "Condición crítica",
    compromised_condition: "Condición comprometida",
    in_observation: "En observación",
    in_treatment: "En tratamiento",
    stable: "Estable",
    constellation_condition_count: "{condition} — casos activos: {count}",
    constellation_on_trip: "Vehículos en viaje: {count}",
  },
};

function counts(
  conditions: Partial<SymptomConstellationCounts["conditions"]>,
  vehiclesOnTrip: number
): SymptomConstellationCounts {
  return {
    conditions: {
      codeBlack: 0,
      critic: 0,
      compromised: 0,
      observation: 0,
      treatment: 0,
      stable: 0,
      ...conditions,
    },
    vehiclesOnTrip,
    ignored: 0,
  };
}

afterEach(cleanup);

describe("EmptyTable constellation counts", () => {
  it("shows zero on every condition and the vehicles on a trip in the center", () => {
    render(<EmptyTable dict={DICT} counts={counts({}, 12)} />);

    expect(
      screen.getByText("Sin condiciones activas por este momento")
    ).toBeTruthy();
    expect(screen.getByLabelText("Vehículos en viaje: 12").textContent).toBe(
      "12"
    );
    for (const label of [
      "Código negro — casos activos: 0",
      "Condición crítica — casos activos: 0",
      "Condición comprometida — casos activos: 0",
      "En observación — casos activos: 0",
      "En tratamiento — casos activos: 0",
      "Estable — casos activos: 0",
    ]) {
      expect(screen.getByLabelText(label).textContent).toBe("0");
    }
  });

  it("puts each condition's active cases on its icon", () => {
    render(
      <EmptyTable
        dict={DICT}
        counts={counts({ codeBlack: 2, compromised: 5, treatment: 1 }, 0)}
      />
    );

    expect(
      screen.getByLabelText("Código negro — casos activos: 2").textContent
    ).toBe("2");
    expect(
      screen.getByLabelText("Condición comprometida — casos activos: 5")
        .textContent
    ).toBe("5");
    expect(
      screen.getByLabelText("En tratamiento — casos activos: 1").textContent
    ).toBe("1");
    expect(screen.getByLabelText("Vehículos en viaje: 0").textContent).toBe(
      "0"
    );
  });

  it("shows no numbers before the counts arrive", () => {
    const { container } = render(<EmptyTable dict={DICT} />);

    expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    expect(
      screen.getByText("Sin condiciones activas por este momento")
    ).toBeTruthy();
  });
});
